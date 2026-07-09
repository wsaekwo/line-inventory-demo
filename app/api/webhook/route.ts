import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { lineClient, replyText, downloadContent } from '@/lib/line';
import { listItems, getItem, sellItem, transferItem } from '@/lib/db';
import { addChatPhoto } from '@/lib/pending-photos';
import { mainMenuMessage, storeQuickReply, categoryQuickReply, itemCarousel } from '@/lib/messages';
import type { WebhookEvent, Message } from '@line/bot-sdk';

export const runtime = 'nodejs';

/**
 * Verifies the x-line-signature header against the raw request body.
 * LINE signs every webhook request with your channel secret — this is
 * how you confirm a request actually came from LINE and not a spoofed caller.
 */
function verifySignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const hash = crypto
    .createHmac('sha256', process.env.LINE_CHANNEL_SECRET ?? '')
    .update(rawBody)
    .digest('base64');
  return hash === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-line-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events: WebhookEvent[] };

  // LINE expects a fast 200 — handle events without blocking the response on slow work.
  await Promise.all(body.events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

async function reply(replyToken: string, message: unknown) {
  return lineClient.replyMessage(replyToken, message as Message);
}

async function handleEvent(event: WebhookEvent) {
  try {
    // First contact (or re-follow after unblocking) — show the menu right away.
    if (event.type === 'follow') {
      if (event.source.type === 'user') {
        // Handy when wiring up OWNER_LINE_USER_IDS — grab it from here, or
        // just have the owner type "id" once they've followed (see below).
        console.log('New follower userId:', event.source.userId);
      }
      await reply(event.replyToken, mainMenuMessage());
      return;
    }

    if (event.type === 'message' && event.message.type === 'image') {
      // Staff sent a photo directly in chat. Pull the binary now — LINE's
      // hosted copy isn't permanent — and stash it in PocketBase right
      // away so the LIFF form only needs to carry a small id around.
      // Consecutive photos from the same person are grouped into one item
      // automatically (see the recency window in lib/pending-photos.ts).
      const buffer = await downloadContent(event.message.id);
      const userId = event.source.type === 'user' ? event.source.userId : 'unknown';

      let liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
      try {
        const pendingPhotoId = await addChatPhoto(buffer, `${event.message.id}.jpg`, userId);
        liffUrl += `?pendingPhotoId=${pendingPhotoId}`;
      } catch (err) {
        // Photo upload failed — still let them register, just without the
        // photo pre-attached, rather than losing the item entirely.
        console.error('Failed to store pending photo:', err);
      }

      await replyText(
        event.replyToken,
        `Photo received. Send more angles if you like, or tap below to add the brand, price and condition:\n${liffUrl}`
      );
      return;
    }

    // Any plain text message falls back to the menu, rather than a canned
    // "not set up to reply" response — this is what staff see if they type
    // something instead of using the buttons. "id"/"myid" is a self-serve
    // way for owners to grab their LINE userId for OWNER_LINE_USER_IDS,
    // without needing to dig through server logs or open a LIFF page.
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim().toLowerCase();
      if ((text === 'id' || text === 'myid') && event.source.type === 'user') {
        await replyText(event.replyToken, `Your LINE user ID:\n${event.source.userId}`);
        return;
      }
      await reply(event.replyToken, mainMenuMessage());
      return;
    }

    if (event.type === 'postback') {
      const params = new URLSearchParams(event.postback.data);
      const action = params.get('action');
      const itemId = params.get('itemId');
      const store = params.get('store');

      if (action === 'pick_store') {
        // Store first, then category — asking both up front would need a
        // 3x4 grid of Quick Replies at once, which doesn't fit LINE's UI well.
        await reply(event.replyToken, storeQuickReply('Which store?', 'pick_category'));
        return;
      }

      if (action === 'pick_category' && store) {
        await reply(event.replyToken, categoryQuickReply(`Category at ${store}?`, store));
        return;
      }

      if (action === 'inventory' && store) {
        const category = params.get('category');
        const items = await listItems({
          store,
          status: 'in_stock',
          category: category && category !== 'all' ? category : undefined,
        });
        if (items.length === 0) {
          await replyText(event.replyToken, `No items in stock at ${store}${category && category !== 'all' ? ` in ${category}` : ''}.`);
        } else {
          await reply(event.replyToken, itemCarousel(items));
        }
        return;
      }

      if (action === 'sold' && itemId) {
        const updated = await sellItem(itemId);
        await replyText(
          event.replyToken,
          updated ? `Marked "${updated.productName}" as sold.` : 'Could not find that item.'
        );
        return;
      }

      if (action === 'transfer_pick' && itemId) {
        const item = await getItem(itemId);
        if (!item) {
          await replyText(event.replyToken, 'Could not find that item.');
          return;
        }
        await reply(
          event.replyToken,
          storeQuickReply(`Transfer "${item.productName}" to which store?`, 'transfer', { itemId }, item.store)
        );
        return;
      }

      if (action === 'transfer' && itemId && store) {
        const updated = await transferItem(itemId, store);
        await replyText(
          event.replyToken,
          updated ? `Transferred "${updated.productName}" to ${store}.` : 'Could not find that item.'
        );
        return;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }
}
