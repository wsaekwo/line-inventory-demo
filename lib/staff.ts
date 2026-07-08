import { getPocketBase } from './pocketbase';

/**
 * Create a `staff` collection in PocketBase with:
 *   lineUserId    text
 *   store         text (or select, matching STORES in lib/schema.ts)
 *   displayName   text, optional
 *
 * Same API rules recommendation as `items`: leave List/View/Create/Update
 * blank (superusers only) — this app is the only thing that reads it.
 *
 * Not auto-populated — add a row per staff member once you have their
 * LINE userId (visible in PocketBase's `items` records after they register
 * something once, or logged from the webhook the first time they message).
 */
export async function getStaffStore(lineUserId: string): Promise<string | null> {
  const pb = await getPocketBase();
  try {
    const record = await pb
      .collection('staff')
      .getFirstListItem(pb.filter('lineUserId = {:id}', { id: lineUserId }));
    return (record.store as string) ?? null;
  } catch {
    // No staff collection yet, or no matching row — both are fine, the
    // rest of the app just falls back to asking.
    return null;
  }
}
