import { getPocketBase } from './pocketbase';
import { deletePendingPhoto, getPendingPhotoUrls } from './pending-photos';
import { InventoryItem, InventoryItemInput, Status, STORES } from './schema';
import type { RecordModel, default as PocketBase } from 'pocketbase';

/**
 * Data lives in PocketBase now. Create a collection named "items" in your
 * PocketBase dashboard with these fields before running this:
 *
 *   brand         text
 *   category      text   (or select, matching CATEGORIES in lib/schema.ts)
 *   productName   text
 *   price         number
 *   condition     text   (or select: S / A / B / C)
 *   store         text   (or select, matching STORES in lib/schema.ts)
 *   status        text   (or select: in_stock / sold)
 *   notes         text   (optional)
 *   lineUserId    text
 *   photos        file, Max Files: 5 (optional — see lib/pending-photos.ts
 *                  for why this is left unprotected)
 *   soldAt        text   (optional)
 *
 * PocketBase already gives every record an `id` and a `created` timestamp,
 * so those aren't separate fields — see toInventoryItem() below.
 *
 * Recommended: leave the collection's List/View/Create/Update API rules
 * blank (superusers only) — this app authenticates as a superuser via
 * lib/pocketbase.ts, so nothing else needs public access to the collection.
 */
const COLLECTION = 'items';

function toInventoryItem(pb: PocketBase, record: RecordModel): InventoryItem {
  const filenames: string[] = Array.isArray(record.photos) ? record.photos : [];
  return {
    id: record.id,
    brand: record.brand,
    category: record.category,
    productName: record.productName,
    price: record.price,
    condition: record.condition,
    store: record.store,
    status: record.status,
    notes: record.notes || undefined,
    lineUserId: record.lineUserId,
    photoUrls: filenames.map((f) => pb.files.getUrl(record, f)),
    registeredAt: record.created,
    soldAt: record.soldAt || undefined,
  };
}

export async function listItems(filter?: { store?: string; status?: Status; category?: string }) {
  const pb = await getPocketBase();
  const parts: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter?.store) {
    parts.push('store = {:store}');
    params.store = filter.store;
  }
  if (filter?.status) {
    parts.push('status = {:status}');
    params.status = filter.status;
  }
  if (filter?.category) {
    parts.push('category = {:category}');
    params.category = filter.category;
  }

  const records = await pb.collection(COLLECTION).getFullList({
    filter: parts.length ? pb.filter(parts.join(' && '), params) : undefined,
    sort: '-created',
  });

  return records.map((r) => toInventoryItem(pb, r));
}

export async function getItem(id: string) {
  const pb = await getPocketBase();
  try {
    const record = await pb.collection(COLLECTION).getOne(id);
    return toInventoryItem(pb, record);
  } catch {
    return null;
  }
}

/**
 * Creates the item record and, if a pendingPhotoId was supplied, copies
 * that photo onto the new record and cleans up the pending_photos row.
 * The copy is a real download+reupload rather than a reference, because
 * pending_photos and items are separate collections with separate
 * lifecycles — items are permanent, pending_photos are meant to be
 * transient (see lib/pending-photos.ts).
 */
export async function createItem(input: InventoryItemInput): Promise<InventoryItem> {
  const pb = await getPocketBase();
  const { pendingPhotoId, ...fields } = input;

  const formData = new FormData();
  Object.entries({ ...fields, status: 'in_stock' }).forEach(([key, value]) => {
    if (value !== undefined) formData.append(key, String(value));
  });

  if (pendingPhotoId) {
    try {
      const photoUrls = await getPendingPhotoUrls(pendingPhotoId);
      for (const url of photoUrls) {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          // Repeated 'photos' entries under the same field name is how the
          // multipart body represents multiple files for one multi-file field.
          formData.append('photos', blob, 'photo.jpg');
        }
      }
    } catch (err) {
      // Missing/expired pending photos shouldn't block registration — the
      // item is still created, just with fewer (or no) photos attached.
      console.error('Could not attach pending photos to new item:', err);
    }
  }

  const record = await pb.collection(COLLECTION).create(formData);

  if (pendingPhotoId) {
    deletePendingPhoto(pendingPhotoId).catch(() => {});
  }

  return toInventoryItem(pb, record);
}

export async function sellItem(id: string) {
  const pb = await getPocketBase();
  try {
    const record = await pb.collection(COLLECTION).update(id, {
      status: 'sold',
      soldAt: new Date().toISOString(),
    });
    return toInventoryItem(pb, record);
  } catch {
    return null;
  }
}

export async function transferItem(id: string, toStore: string) {
  const pb = await getPocketBase();
  try {
    const record = await pb.collection(COLLECTION).update(id, { store: toStore });
    return toInventoryItem(pb, record);
  } catch {
    return null;
  }
}

export interface PeriodSummary {
  store: string | 'all';
  periodDays: number;
  newlyRegistered: number;
  sold: number;
  revenue: number;
}

/**
 * Summary over a rolling window (default 7 days), optionally scoped to one
 * store. "newlyRegistered" counts items created in the window; "sold"/
 * "revenue" count items sold in the window (by soldAt), regardless of when
 * they were originally registered — that split is what makes this a real
 * period report instead of an all-time total.
 */
export async function periodSummary(opts?: { store?: string; days?: number }): Promise<PeriodSummary> {
  const days = opts?.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const items = await listItems({ store: opts?.store });
  const newlyRegistered = items.filter((i) => new Date(i.registeredAt) >= since).length;
  const soldInPeriod = items.filter((i) => i.status === 'sold' && i.soldAt && new Date(i.soldAt) >= since);

  return {
    store: opts?.store ?? 'all',
    periodDays: days,
    newlyRegistered,
    sold: soldInPeriod.length,
    revenue: soldInPeriod.reduce((sum, i) => sum + i.price, 0),
  };
}

export interface FullSalesReport {
  periodDays: number;
  total: PeriodSummary;
  perStore: PeriodSummary[];
}

/** All-stores total plus a per-store breakdown, for the owner report push. */
export async function fullSalesReport(days = 7): Promise<FullSalesReport> {
  const total = await periodSummary({ days });
  const perStore = await Promise.all(STORES.map((store) => periodSummary({ store, days })));
  return { periodDays: days, total, perStore };
}
