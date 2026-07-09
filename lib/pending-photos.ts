import { getPocketBase } from './pocketbase';

/**
 * Create a `pending_photos` collection in PocketBase with:
 *   photo         file
 *   lineUserId    text
 *
 * A photo is uploaded here the moment it's captured (sent in chat, or taken
 * inside the LIFF form) — before the rest of the item's details exist. The
 * registration form only needs to carry a small id around after that,
 * rather than the image bytes themselves. Once the item is actually
 * registered, lib/db.ts copies the photo onto the item record and deletes
 * the pending_photos row.
 *
 * The `photo` field is left UNPROTECTED (PocketBase's default) rather than
 * marked "Protected" in the field settings. This is a deliberate trade-off:
 * an unprotected file's URL is public to anyone who has it, but PocketBase
 * appends a random suffix to every filename, so the URL isn't guessable —
 * and it means LINE's own servers can fetch the image directly for Flex
 * Message hero images and confirmation cards without needing a short-lived
 * token minted for every push. Same rule recommendation as `items` and
 * `staff` for the collection's List/View/Create/Update API rules though —
 * leave them blank (superusers only), since the *records* (who uploaded
 * what, when) are more sensitive than the image bytes themselves.
 */
const COLLECTION = 'pending_photos';

export async function createPendingPhoto(buffer: Buffer, filename: string, lineUserId: string): Promise<string> {
  const pb = await getPocketBase();
  const formData = new FormData();
  formData.append('lineUserId', lineUserId);
  formData.append('photo', new Blob([new Uint8Array(buffer)]), filename);
  const record = await pb.collection(COLLECTION).create(formData);
  return record.id;
}

export async function getPendingPhotoUrl(id: string): Promise<string | null> {
  const pb = await getPocketBase();
  try {
    const record = await pb.collection(COLLECTION).getOne(id);
    if (!record.photo) return null;
    return pb.files.getUrl(record, record.photo as string);
  } catch {
    return null;
  }
}

export async function deletePendingPhoto(id: string): Promise<void> {
  const pb = await getPocketBase();
  await pb
    .collection(COLLECTION)
    .delete(id)
    .catch(() => {
      // Non-fatal — worst case an orphaned pending_photos row sits unused.
    });
}
