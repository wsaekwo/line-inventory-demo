import { STORES, CATEGORIES, InventoryItem } from './schema';
import type { PeriodSummary, FullSalesReport } from './db';
import { t, storeLabel, categoryLabel, type Lang } from './i18n';

// LINE flex carousels support up to 12 bubbles; capped a little below that
// as a safety margin rather than relying on the exact platform limit.
const MAX_CAROUSEL_ITEMS = 10;
// Quick Reply button labels are capped at 20 characters by LINE.
const MAX_LABEL_LENGTH = 20;

export function mainMenuQuickReplyItems(lang: Lang) {
  return [
    {
      type: 'action',
      action: {
        type: 'uri',
        label: t(lang, 'menuNewItem'),
        uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`,
      },
    },
    {
      type: 'action',
      action: {
        type: 'postback',
        label: t(lang, 'menuInventory'),
        data: 'action=pick_store',
        displayText: t(lang, 'menuInventoryDisplay'),
      },
    },
  ];
}

export function mainMenuMessage(lang: Lang) {
  return {
    type: 'text',
    text: t(lang, 'menuPrompt'),
    quickReply: { items: mainMenuQuickReplyItems(lang) },
  };
}

/**
 * A text message with one Quick Reply button per store, optionally
 * excluding one (e.g. an item's current store when picking a transfer
 * destination). `extra` params are carried through to the postback data
 * so the next step (e.g. which itemId this concerns) isn't lost.
 *
 * `homeStore`, when given, adds a "🏠 My Store" shortcut first and drops
 * that store from the plain list below it — for staff with a known store
 * (see lib/staff.ts), so they don't have to pick their own store from a
 * flat list every time.
 *
 * Button labels are localized for display, but the postback `store` value
 * stays the canonical English string from lib/schema.ts — that's what's
 * filtered on and stored, locale never touches it.
 */
export function storeQuickReply(
  lang: Lang,
  text: string,
  actionName: string,
  extra: Record<string, string> = {},
  excludeStore?: string,
  homeStore?: string
) {
  const stores = STORES.filter((s) => s !== excludeStore && s !== homeStore);
  const toItem = (store: string, label: string) => ({
    type: 'action',
    action: {
      type: 'postback',
      label: label.slice(0, MAX_LABEL_LENGTH),
      data: new URLSearchParams({ action: actionName, store, ...extra }).toString(),
      displayText: storeLabel(lang, store),
    },
  });

  const items = [
    ...(homeStore && homeStore !== excludeStore ? [toItem(homeStore, t(lang, 'myStore'))] : []),
    ...stores.map((store) => toItem(store, storeLabel(lang, store))),
  ];

  return { type: 'text', text, quickReply: { items } };
}

export function categoryQuickReply(lang: Lang, store: string) {
  const options = ['All', ...CATEGORIES];
  return {
    type: 'text',
    text: t(lang, 'categoryAt', { store: storeLabel(lang, store) }),
    quickReply: {
      items: options.map((category) => ({
        type: 'action',
        action: {
          type: 'postback',
          label: (category === 'All' ? t(lang, 'categoryAll') : categoryLabel(lang, category)).slice(0, MAX_LABEL_LENGTH),
          data: new URLSearchParams({
            action: 'inventory',
            store,
            category: category === 'All' ? 'all' : category,
          }).toString(),
          displayText: category === 'All' ? t(lang, 'categoryAll') : categoryLabel(lang, category),
        },
      })),
    },
  };
}

/**
 * Builds one native LINE image message per photo, rather than trying to
 * cram multiple images into a Flex bubble (which only supports a single
 * hero image each). LINE allows up to 5 messages per reply, which happens
 * to match MAX_PHOTOS exactly — every photo an item can have fits in one
 * reply. Each image gets full native pinch-zoom/save when tapped, which
 * Flex-embedded images don't get.
 */
export function photoMessages(photoUrls: string[]) {
  return photoUrls.map((url) => ({
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: url,
  }));
}

export function itemCarousel(lang: Lang, items: InventoryItem[]) {
  const shown = items.slice(0, MAX_CAROUSEL_ITEMS);
  return {
    type: 'flex',
    altText: `${items.length} item${items.length === 1 ? '' : 's'} in stock`,
    contents: {
      type: 'carousel',
      contents: shown.map((item) => ({
        type: 'bubble',
        size: 'kilo',
        hero: item.photoUrls[0]
          ? {
              type: 'image',
              url: item.photoUrls[0],
              size: 'full',
              aspectRatio: '20:13',
              aspectMode: 'cover',
              action: {
                type: 'postback',
                label: t(lang, 'viewPhotos'),
                data: `action=view_photos&itemId=${item.id}`,
                displayText: t(lang, 'viewPhotos'),
              },
            }
          : undefined,
        body: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#16140F',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: `${categoryLabel(lang, item.category).toUpperCase()} · ${item.brand}`,
              size: 'xs',
              color: '#B08D57',
              weight: 'bold',
            },
            {
              type: 'text',
              text: item.productName,
              size: 'md',
              color: '#EFE8DA',
              weight: 'bold',
              wrap: true,
              margin: 'xs',
            },
            {
              type: 'text',
              text: `¥${item.price.toLocaleString()} · ${item.condition}`,
              size: 'xs',
              color: '#A69C89',
              margin: 'sm',
            },
            {
              type: 'text',
              text:
                item.photoUrls.length > 1
                  ? `${storeLabel(lang, item.store)} · ${item.photoUrls.length}`
                  : storeLabel(lang, item.store),
              size: 'xs',
              color: '#A69C89',
              wrap: true,
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#6E2A2A',
              height: 'sm',
              action: {
                type: 'postback',
                label: t(lang, 'reportSold'),
                data: `action=sold&itemId=${item.id}`,
                displayText: `${t(lang, 'reportSold')}: ${item.productName}`,
              },
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'postback',
                label: lang === 'ja' ? '移動' : 'Transfer',
                data: `action=transfer_pick&itemId=${item.id}`,
                displayText: `${lang === 'ja' ? '移動' : 'Transfer'}: ${item.productName}`,
              },
            },
          ],
        },
      })),
    },
  };
}

export function reportFlex(lang: Lang, summary: PeriodSummary, maxRevenueForBar?: number) {
  const label = summary.store === 'all' ? t(lang, 'reportAllStores') : storeLabel(lang, summary.store);
  const bar =
    maxRevenueForBar && maxRevenueForBar > 0
      ? [
          {
            type: 'box',
            layout: 'horizontal',
            height: '6px',
            margin: 'md',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: Math.max(2, Math.round((summary.revenue / maxRevenueForBar) * 100)),
                backgroundColor: '#B08D57',
                contents: [],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 100 - Math.max(2, Math.round((summary.revenue / maxRevenueForBar) * 100)),
                backgroundColor: '#2E2A22',
                contents: [],
              },
            ],
          },
        ]
      : [];

  return {
    type: 'flex',
    altText: `${label} — ${summary.periodDays}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16140F',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: t(lang, 'reportSummary', { days: summary.periodDays }), size: 'xs', color: '#B08D57', weight: 'bold' },
          { type: 'text', text: label, size: 'lg', color: '#EFE8DA', weight: 'bold', margin: 'sm', wrap: true },
          { type: 'separator', margin: 'md', color: '#2E2A22' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: t(lang, 'reportNewItems'), size: 'sm', color: '#A69C89', flex: 1 },
              { type: 'text', text: String(summary.newlyRegistered), size: 'sm', color: '#EFE8DA', align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: t(lang, 'reportSold'), size: 'sm', color: '#A69C89', flex: 1 },
              { type: 'text', text: String(summary.sold), size: 'sm', color: '#EFE8DA', align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: t(lang, 'reportRevenue'), size: 'sm', color: '#A69C89', flex: 1 },
              { type: 'text', text: `¥${summary.revenue.toLocaleString()}`, size: 'sm', color: '#EFE8DA', align: 'end' },
            ],
          },
          ...bar,
        ],
      },
    },
  };
}

/**
 * The report actually pushed to owners: an "All stores" bubble first, then
 * one bubble per store with a simple proportional bar so relative revenue
 * is visible at a glance — as close to a "chart" as Flex Messages reasonably
 * support without generating and hosting an actual image.
 */
export function salesReportCarousel(lang: Lang, report: FullSalesReport) {
  const maxRevenue = Math.max(1, ...report.perStore.map((s) => s.revenue));
  const bubbles = [reportFlex(lang, report.total), ...report.perStore.map((s) => reportFlex(lang, s, maxRevenue))];
  return {
    type: 'flex',
    altText: `${report.periodDays}-day sales report`,
    contents: { type: 'carousel', contents: bubbles.map((b) => b.contents) },
  };
}
