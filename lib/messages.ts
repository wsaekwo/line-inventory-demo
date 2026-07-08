import { STORES, CATEGORIES, InventoryItem } from './schema';
import type { PeriodSummary, FullSalesReport } from './db';

// LINE flex carousels support up to 12 bubbles; capped a little below that
// as a safety margin rather than relying on the exact platform limit.
const MAX_CAROUSEL_ITEMS = 10;
// Quick Reply button labels are capped at 20 characters by LINE.
const MAX_LABEL_LENGTH = 20;

export function mainMenuMessage() {
  return {
    type: 'text',
    text: 'What would you like to do?',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'uri',
            label: '📷 New Item',
            uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`,
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '📦 Inventory',
            data: 'action=pick_store',
            displayText: 'Inventory',
          },
        },
      ],
    },
  };
}

/**
 * A text message with one Quick Reply button per store, optionally
 * excluding one (e.g. an item's current store when picking a transfer
 * destination). `extra` params are carried through to the postback data
 * so the next step (e.g. which itemId this concerns) isn't lost.
 */
export function storeQuickReply(text: string, actionName: string, extra: Record<string, string> = {}, excludeStore?: string) {
  const stores = STORES.filter((s) => s !== excludeStore);
  return {
    type: 'text',
    text,
    quickReply: {
      items: stores.map((store) => ({
        type: 'action',
        action: {
          type: 'postback',
          label: store.slice(0, MAX_LABEL_LENGTH),
          data: new URLSearchParams({ action: actionName, store, ...extra }).toString(),
          displayText: store,
        },
      })),
    },
  };
}

export function categoryQuickReply(text: string, store: string) {
  const options = ['All', ...CATEGORIES];
  return {
    type: 'text',
    text,
    quickReply: {
      items: options.map((category) => ({
        type: 'action',
        action: {
          type: 'postback',
          label: category.slice(0, MAX_LABEL_LENGTH),
          data: new URLSearchParams({
            action: 'inventory',
            store,
            category: category === 'All' ? 'all' : category,
          }).toString(),
          displayText: category,
        },
      })),
    },
  };
}

export function itemCarousel(items: InventoryItem[]) {
  const shown = items.slice(0, MAX_CAROUSEL_ITEMS);
  return {
    type: 'flex',
    altText: `${items.length} item${items.length === 1 ? '' : 's'} in stock`,
    contents: {
      type: 'carousel',
      contents: shown.map((item) => ({
        type: 'bubble',
        size: 'kilo',
        body: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#16140F',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: `${item.category.toUpperCase()} · ${item.brand}`, size: 'xs', color: '#B08D57', weight: 'bold' },
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
              text: `¥${item.price.toLocaleString()} · Grade ${item.condition}`,
              size: 'xs',
              color: '#A69C89',
              margin: 'sm',
            },
            { type: 'text', text: item.store, size: 'xs', color: '#A69C89', wrap: true },
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
                label: 'Sold',
                data: `action=sold&itemId=${item.id}`,
                displayText: `Sold: ${item.productName}`,
              },
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'postback',
                label: 'Transfer',
                data: `action=transfer_pick&itemId=${item.id}`,
                displayText: `Transfer: ${item.productName}`,
              },
            },
          ],
        },
      })),
    },
  };
}

export function reportFlex(summary: PeriodSummary, maxRevenueForBar?: number) {
  const storeLabel = summary.store === 'all' ? 'All stores' : summary.store;
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
    altText: `${storeLabel} — ${summary.periodDays}-day summary`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#16140F',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: `${summary.periodDays}-DAY SUMMARY`, size: 'xs', color: '#B08D57', weight: 'bold' },
          { type: 'text', text: storeLabel, size: 'lg', color: '#EFE8DA', weight: 'bold', margin: 'sm', wrap: true },
          { type: 'separator', margin: 'md', color: '#2E2A22' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: 'New items', size: 'sm', color: '#A69C89', flex: 1 },
              { type: 'text', text: String(summary.newlyRegistered), size: 'sm', color: '#EFE8DA', align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'Sold', size: 'sm', color: '#A69C89', flex: 1 },
              { type: 'text', text: String(summary.sold), size: 'sm', color: '#EFE8DA', align: 'end' },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'Revenue', size: 'sm', color: '#A69C89', flex: 1 },
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
export function salesReportCarousel(report: FullSalesReport) {
  const maxRevenue = Math.max(1, ...report.perStore.map((s) => s.revenue));
  const bubbles = [reportFlex(report.total), ...report.perStore.map((s) => reportFlex(s, maxRevenue))];
  return {
    type: 'flex',
    altText: `${report.periodDays}-day sales report`,
    contents: { type: 'carousel', contents: bubbles.map((b) => b.contents) },
  };
}
