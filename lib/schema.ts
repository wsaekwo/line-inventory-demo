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
  photoDataUrl: z.string().optional(), // base64 preview captured client-side for the demo
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// A transfer changes an item's `store`, not its `status` — the item is still
// in stock, just at a different location. `status` only tracks whether it's
// sellable at all.
export const STATUS = ['in_stock', 'sold'] as const;
export type Status = (typeof STATUS)[number];

export interface InventoryItem extends InventoryItemInput {
  id: string;
  status: Status;
  registeredAt: string;
  registeredByName?: string;
  soldAt?: string;
}
