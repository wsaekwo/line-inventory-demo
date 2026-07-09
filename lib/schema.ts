import { z } from 'zod';

export const CONDITIONS = ['S', 'A', 'B', 'C'] as const;
export const STORES = ['Store A — Ginza', 'Store B — Omotesando', 'Store C — Shinjuku'] as const;
export const CATEGORIES = ['Bags', 'Watches', 'Jewelry', 'Accessories'] as const;

export const inventoryItemSchema = z.object({
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  brand: z.string().min(1, 'Select a brand'),
  productName: z.string().min(1, 'Enter the item name'),
  price: z
    .number({ invalid_type_error: 'Enter a price' })
    .int()
    .positive('Price must be greater than 0'),
  condition: z.enum(CONDITIONS, { errorMap: () => ({ message: 'Select a condition grade' }) }),
  store: z.enum(STORES, { errorMap: () => ({ message: 'Select a store' }) }),
  notes: z.string().max(280).optional(),
  lineUserId: z.string().min(1),
  // References a pending_photos record already uploaded to PocketBase (via
  // chat photo or in-form camera capture) — not the photo itself. The photo
  // bytes are copied onto the item record server-side in lib/db.ts.
  pendingPhotoId: z.string().optional(),
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// A transfer changes an item's `store`, not its `status` — the item is still
// in stock, just at a different location. `status` only tracks whether it's
// sellable at all.
export const STATUS = ['in_stock', 'sold'] as const;
export type Status = (typeof STATUS)[number];

// The stored/returned shape is deliberately not InventoryItemInput +
// extras: `pendingPhotoId` is a write-only instruction, not a property of
// a saved item, so it's left out here on purpose.
// Bounds both the LIFF form's "add another photo" and the recommended
// PocketBase "Max Files" setting on items.photos / pending_photos.photos.
export const MAX_PHOTOS = 5;

export interface InventoryItem {
  id: string;
  category: (typeof CATEGORIES)[number];
  brand: string;
  productName: string;
  price: number;
  condition: (typeof CONDITIONS)[number];
  store: (typeof STORES)[number] | string;
  notes?: string;
  lineUserId: string;
  status: Status;
  registeredAt: string;
  soldAt?: string;
  // Public PocketBase file URLs, in upload order. Empty if no photo attached.
  photoUrls: string[];
}
