import { getPocketBase } from './pocketbase';
import type PocketBase from 'pocketbase';

/**
 * Create a `pending_photos` collection in PocketBase with:
 *   photos        file, Max Files: 5 (matches MAX_PHOTOS in lib/schema.ts)
 *   lineUserId    text
 *
 * Photos land here as soon as they're captured — before the rest of an
 * item's details exist — and an item can accumulate several before the
 * form is ever submitted (a few chat photos in a row, or several picked
 * at once in the form). The registration form only carries a small
 * session id around after the first photo, not the image bytes. Once the
 * item is registered, lib/db.ts copies all of the session's photos onto
 * the item record and deletes the pending_photos row.
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

interface NewFile {
  buffer: Buffer;
  filename: string;
}

/**
 * Adds one or more new files to a session, keeping whatever was already
 * there. PocketBase's `fieldName+` append modifier for file fields only
 * exists on server v0.23+ — on older servers it's silently ignored, which
 * looks exactly like "only the first photo ever gets saved" (every
 * "append" quietly does nothing). This works on any version instead: it
 * doesn't rely on a modifier at all, it downloads whatever's already in
 * the session and resubmits the complete file set — old files plus new —
 * in a single update. A little more transfer than a true append, but
 * correct everywhere, and sessions are small and short-lived so the
 * overhead is minor.
 */
async function submitPhotos(
  pb: PocketBase,
  existingId: string | null,
  newFiles: NewFile[],
  lineUserId: string
): Promise<string> {
  const formData = new FormData();

  if (existingId) {
    const record = await pb.collection(COLLECTION).getOne(existingId);
    const existingFilenames: string[] = Array.isArray(record.photos) ? record.photos : [];
    const existingBlobs = await Promise.all(
      existingFilenames.map(async (fname) => {
        const res = await fetch(pb.files.getUrl(record, fname));
        return { blob: await res.blob(), filename: fname };
      })
    );
    existingBlobs.forEach(({ blob, filename }) => formData.append('photos', blob, filename));
  } else {
    formData.append('lineUserId', lineUserId);
  }

  newFiles.forEach(({ buffer, filename }) => {
    formData.append('photos', new Blob([new Uint8Array(buffer)]), filename);
  });

  const record = existingId
    ? await pb.collection(COLLECTION).update(existingId, formData)
    : await pb.collection(COLLECTION).create(formData);

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
  return submitPhotos(pb, existingId, [{ buffer, filename }], lineUserId);
}

/**
 * For the LIFF form — one or more files picked at once (multi-select) or
 * a single camera capture. The client already knows its session id after
 * the first call (pass it as existingId); pass null only for the very
 * first photo of a new item.
 */
export async function addFormPhotos(
  existingId: string | null,
  files: NewFile[],
  lineUserId: string
): Promise<string> {
  const pb = await getPocketBase();
  return submitPhotos(pb, existingId, files, lineUserId);
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
