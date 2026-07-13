import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { lineClient, downloadContent } from '@/lib/line';
import { listItems, getItem, sellItem, transferItem } from '@/lib/db';
import { addChatPhoto } from '@/lib/pending-photos';
import { getStaffStore } from '@/lib/staff';
import { setLangOverride } from '@/lib/user-lang';
import { linkRichMenuForLang } from '@/lib/rich-menu';
import { getUserLanguage } from '@/lib/bot-lang';
import { t, storeLabel, categoryLabel, type Lang } from '@/lib/i18n';
import { mainMenuMessage, storeQuickReply, categoryQuickReply, itemCarousel, photoMessages } from '@/lib/messages';
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

async function replyText(replyToken: string, text: string) {
  return reply(replyToken, { type: 'text', text });
}

/** Sends up to 5 images as one reply. */
async function replyPhotos(replyToken: string, photoUrls: string[]) {
  const messages = photoMessages(photoUrls.slice(0, 5));
  if (messages.length === 0) return;
  return lineClient.replyMessage(replyToken, messages as Message[]);
}

async function handleEvent(event: WebhookEvent) {
  try {
    const userId = 'source' in event && event.source.type === 'user' ? event.source.userId : null;
    // Resolved once per event and threaded through everything below —
    // avoids re-fetching the profile for every message this handler sends.
    const lang: Lang = userId ? await getUserLanguage(userId) : 'ja';

    // First contact (or re-follow after unblocking) — show the menu right away.
    if (event.type === 'follow') {
      if (userId) {
        // Handy when wiring up OWNER_LINE_USER_IDS — grab it from here, or
        // just have the owner type "id" once they've followed (see below).
        console.log('New follower userId:', userId);
        // Account-wide default is Japanese — only English followers need
        // an explicit link. Fire-and-forget: cosmetic, shouldn't delay the reply.
        if (lang === 'en') linkRichMenuForLang(userId, lang);
      }
      await reply(event.replyToken, mainMenuMessage(lang));
      return;
    }

    if (event.type === 'message' && event.message.type === 'image') {
      // Staff sent a photo directly in chat. Pull the binary now — LINE's
      // hosted copy isn't permanent — and stash it in PocketBase right
      // away so the LIFF form only needs to carry a small id around.
      // Consecutive photos from the same person are grouped into one item
      // automatically (see the recency window in lib/pending-photos.ts).
      const buffer = await downloadContent(event.message.id);

      let liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
      try {
        const pendingPhotoId = await addChatPhoto(buffer, `${event.message.id}.jpg`, userId ?? 'unknown');
        liffUrl += `?pendingPhotoId=${pendingPhotoId}`;
      } catch (err) {
        // Photo upload failed — still let them register, just without the
        // photo pre-attached, rather than losing the item entirely.
        console.error('Failed to store pending photo:', err);
      }

      await replyText(event.replyToken, t(lang, 'photoReceived', { url: liffUrl }));
      return;
    }

    // Any plain text message falls back to the menu, rather than a canned
    // "not set up to reply" response — this is what staff see if they type
    // something instead of using the buttons. "id"/"myid" is a self-serve
    // way for owners to grab their LINE userId for OWNER_LINE_USER_IDS,
    // without needing to dig through server logs or open a LIFF page.
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim().toLowerCase();

      if ((text === 'english' || text === '日本語') && userId) {
        const newLang: Lang = text === 'english' ? 'en' : 'ja';
        await setLangOverride(userId, newLang);
        await linkRichMenuForLang(userId, newLang);
        await replyText(event.replyToken, t(newLang, newLang === 'en' ? 'languageSetEnglish' : 'languageSetJapanese'));
        return;
      }

      if ((text === 'id' || text === 'myid') && userId) {
        await replyText(event.replyToken, t(lang, 'yourUserId', { id: userId }));
        return;
      }
      await reply(event.replyToken, mainMenuMessage(lang));
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
        const homeStore = userId ? await getStaffStore(userId) : null;
        await reply(
          event.replyToken,
          storeQuickReply(lang, t(lang, 'whichStore'), 'pick_category', {}, undefined, homeStore ?? undefined)
        );
        return;
      }

      if (action === 'pick_category' && store) {
        await reply(event.replyToken, categoryQuickReply(lang, store));
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
          const categoryFragment =
            category && category !== 'all' ? t(lang, 'inCategory', { category: categoryLabel(lang, category) }) : '';
          await replyText(
            event.replyToken,
            t(lang, 'noItemsInStock', { store: storeLabel(lang, store), category: categoryFragment })
          );
        } else {
          await reply(event.replyToken, itemCarousel(lang, items));
        }
        return;
      }

      if (action === 'view_photos' && itemId) {
        const item = await getItem(itemId);
        if (!item || item.photoUrls.length === 0) {
          await replyText(event.replyToken, t(lang, 'noPhotosForItem'));
          return;
        }
        await replyPhotos(event.replyToken, item.photoUrls);
        return;
      }

      if (action === 'sold' && itemId) {
        const updated = await sellItem(itemId);
        await replyText(
          event.replyToken,
          updated ? t(lang, 'markedSold', { name: updated.productName }) : t(lang, 'itemNotFound')
        );
        return;
      }

      if (action === 'transfer_pick' && itemId) {
        const item = await getItem(itemId);
        if (!item) {
          await replyText(event.replyToken, t(lang, 'itemNotFound'));
          return;
        }
        await reply(
          event.replyToken,
          storeQuickReply(lang, t(lang, 'transferPrompt', { name: item.productName }), 'transfer', { itemId }, item.store)
        );
        return;
      }

      if (action === 'transfer' && itemId && store) {
        const updated = await transferItem(itemId, store);
        await replyText(
          event.replyToken,
          updated ? t(lang, 'transferredTo', { name: updated.productName, store: storeLabel(lang, store) }) : t(lang, 'itemNotFound')
        );
        return;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }
}
