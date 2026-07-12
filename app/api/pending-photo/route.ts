import { NextRequest, NextResponse } from 'next/server';
import { addFormPhotos } from '@/lib/pending-photos';

export const runtime = 'nodejs';

/**
 * Used by the LIFF form for photos captured or picked in-app (as opposed
 * to ones sent directly in chat, which the webhook uploads itself).
 * Accepts one or more `photo` entries in a single request — the form
 * sends everything selected in one multi-select picker action as one
 * call here, rather than one request per file.
 *
 * Pass `pendingPhotoId` (from a previous call, or from a chat-sent photo)
 * to add these to that same session instead of starting a new one.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const photos = formData.getAll('photo').filter((p): p is File => p instanceof File);
  const lineUserId = formData.get('lineUserId');
  const existingId = formData.get('pendingPhotoId');

  if (photos.length === 0 || typeof lineUserId !== 'string' || !lineUserId) {
    return NextResponse.json({ error: 'at least one photo and lineUserId are required' }, { status: 400 });
  }

  try {
    const files = await Promise.all(
      photos.map(async (photo) => ({
        buffer: Buffer.from(await photo.arrayBuffer()),
        filename: photo.name || 'photo.jpg',
      }))
    );
    const id = await addFormPhotos(typeof existingId === 'string' ? existingId : null, files, lineUserId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('Failed to upload pending photo(s):', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
