import { getPocketBase } from './pocketbase';
import type PocketBase from 'pocketbase';

/**
 * Create a `pending_photos` collection in PocketBase with:
 *   photos        file, Max Files: 5 (matches MAX_PHOTOS in lib/schema.ts)
 *   lineUserId    text
 *
 * Photos land here as soon as they're captured — before the rest of an
 * item's details exist — and an item can accumulate several before the
 * form is ever submitted (a few chat photos in a row, or "add another
 * photo" in the form). The registration form only carries a small session
 * id around after the first photo, not the image bytes. Once the item is
 * registered, lib/db.ts copies all of the session's photos onto the item
 * record and deletes the pending_photos row.
 *
 * The `photos` field is left UNPROTECTED (PocketBase's default) rather
 * than marked "Protected" in the field settings — see the note in
 * README.md under "Photo flow" for why.
 */
const COLLECTION = 'pending_photos';

// Chat photos have no client-side state to say "this is the same item as
// the last photo" — each webhook call is independent. So consecutive chat
// photos from the same person are grouped into one session as long as the
// gap between them is under this window; a longer gap starts a fresh item
// instead of (likely wrongly) attaching to an abandoned one.
const CHAT_SESSION_WINDOW_MS = 10 * 60 * 1000;

async function appendOrCreate(
  pb: PocketBase,
  existingId: string | null,
  buffer: Buffer,
  filename: string,
  lineUserId: string
): Promise<string> {
  const blob = new Blob([new Uint8Array(buffer)]);

  if (existingId) {
    const formData = new FormData();
    // The `+` suffix appends to a multi-file field instead of replacing it.
    formData.append('photos+', blob, filename);
    const record = await pb.collection(COLLECTION).update(existingId, formData);
    return record.id;
  }

  const formData = new FormData();
  formData.append('lineUserId', lineUserId);
  formData.append('photos', blob, filename);
  const record = await pb.collection(COLLECTION).create(formData);
  return record.id;
}

async function findRecentSession(pb: PocketBase, lineUserId: string) {
  try {
    const record = await pb
      .collection(COLLECTION)
      .getFirstListItem(pb.filter('lineUserId = {:id}', { id: lineUserId }), { sort: '-updated' });
    const age = Date.now() - new Date(record.updated).getTime();
    return age < CHAT_SESSION_WINDOW_MS ? record.id : null;
  } catch {
    return null;
  }
}

/**
 * For photos sent directly in chat. Groups consecutive photos from the
 * same person into one session using recency, since the webhook has no
 * other way to know they belong together.
 */
export async function addChatPhoto(buffer: Buffer, filename: string, lineUserId: string): Promise<string> {
  const pb = await getPocketBase();
  const existingId = await findRecentSession(pb, lineUserId);
  return appendOrCreate(pb, existingId, buffer, filename, lineUserId);
}

/**
 * For the LIFF form's own camera capture. The client already knows its
 * session id after the first photo (pass it as existingId), so this
 * doesn't need the recency heuristic — pass null only for the first photo.
 */
export async function addFormPhoto(
  existingId: string | null,
  buffer: Buffer,
  filename: string,
  lineUserId: string
): Promise<string> {
  const pb = await getPocketBase();
  return appendOrCreate(pb, existingId, buffer, filename, lineUserId);
}

export async function getPendingPhotoUrls(id: string): Promise<string[]> {
  const pb = await getPocketBase();
  try {
    const record = await pb.collection(COLLECTION).getOne(id);
    const filenames: string[] = Array.isArray(record.photos) ? record.photos : [];
    return filenames.map((f) => pb.files.getUrl(record, f));
  } catch {
    return [];
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
