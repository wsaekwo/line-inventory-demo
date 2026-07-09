import { NextRequest, NextResponse } from 'next/server';
import { inventoryItemSchema } from '@/lib/schema';
import { createItem, listItems } from '@/lib/db';
import { pushFlex } from '@/lib/line';

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
    await pushFlex(item.lineUserId, `Registered: ${item.productName}`, buildTicketFlex(item));
  } catch (err) {
    // Don't fail the registration if the push fails (e.g. quota exhausted) —
    // the item is already saved; just log it.
    console.error('Push confirmation failed:', err);
  }

  return NextResponse.json({ item }, { status: 201 });
}

function buildTicketFlex(item: {
  productName: string;
  brand: string;
  category: string;
  price: number;
  condition: string;
  store: string;
  id: string;
  photoUrls: string[];
}) {
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
        { type: 'text', text: 'REGISTERED', size: 'xs', color: '#B08D57', weight: 'bold' },
        { type: 'text', text: item.productName, size: 'lg', color: '#EFE8DA', weight: 'bold', margin: 'sm', wrap: true },
        {
          type: 'text',
          text:
            item.photoUrls.length > 1
              ? `${item.category} · ${item.brand} · ${item.photoUrls.length} photos`
              : `${item.category} · ${item.brand}`,
          size: 'sm',
          color: '#A69C89',
          margin: 'xs',
        },
        { type: 'separator', margin: 'md', color: '#2E2A22' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'Price', size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: `¥${item.price.toLocaleString()}`, size: 'sm', color: '#EFE8DA', align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'Grade', size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: item.condition, size: 'sm', color: '#EFE8DA', align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'Store', size: 'sm', color: '#A69C89', flex: 1 },
            { type: 'text', text: item.store, size: 'sm', color: '#EFE8DA', align: 'end', wrap: true },
          ],
        },
      ],
    },
  };
}
