import { NextRequest, NextResponse } from 'next/server';
import { inventoryItemSchema } from '@/lib/schema';
import { createItem, listItems } from '@/lib/db';
import { pushFlex } from '@/lib/line';
import { getUserLanguage } from '@/lib/bot-lang';
import { t, storeLabel, categoryLabel, type Lang } from '@/lib/i18n';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get('store') ?? undefined;
  const items = await listItems({ store });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = inventoryItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await createItem(parsed.data);

  // Push an appraisal-ticket style confirmation card back into the chat the
  // item was registered from. This uses push quota, so keep it to one push
  // per registration rather than one per intermediate step.
  try {
    const lang = await getUserLanguage(item.lineUserId);
    await pushFlex(item.lineUserId, `${t(lang, 'ticketBadge')}: ${item.productName}`, buildTicketFlex(lang, item));
  } catch (err) {
    // Don't fail the registration if the push fails (e.g. quota exhausted) —
    // the item is already saved; just log it.
    console.error('Push confirmation failed:', err);
  }

  return NextResponse.json({ item }, { status: 201 });
}

function buildTicketFlex(
  lang: Lang,
  item: {
    productName: string;
    brand: string;
    category: string;
    price: number;
    condition: string;
    store: string;
    id: string;
    photoUrls: string[];
  }
) {
  const subtitle =
    item.photoUrls.length > 1
      ? `${categoryLabel(lang, item.category)} · ${item.brand} · ${t(lang, 'photosCount', { count: item.photoUrls.length })}`
      : `${categoryLabel(lang, item.category)} · ${item.brand}`;

  return {
    type: 'bubble',
    size: 'kilo',
    hero: item.photoUrls[0]
      ? { type: 'image', url: item.photoUrls[0], size: 'full', aspectRatio: '20:13', aspectMode: 'cover' }
      : undefined,
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#16140F',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: t(lang, 'ticketBadge'), size: 'xs', color: '#B08D57', weight: 'bold' },
        { type: 'text', text: item.productName, size: 'lg', color: '#EFE8DA', weight: 'bold', margin: 'sm', wrap: true },
        { type: 'text', text: subtitle, size: 'sm', color: '#A69C89', margin: 'xs' },
        { type: 'separator', margin: 'md', color: '#2E2A22' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: t(lang, 'ticketPrice'), size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: `¥${item.price.toLocaleString()}`, size: 'sm', color: '#EFE8DA', align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: t(lang, 'ticketGrade'), size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: item.condition, size: 'sm', color: '#EFE8DA', align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: t(lang, 'ticketStore'), size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: storeLabel(lang, item.store), size: 'sm', color: '#EFE8DA', align: 'end', wrap: true },
          ],
        },
      ],
    },
  };
}
