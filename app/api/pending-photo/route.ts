import { NextRequest, NextResponse } from 'next/server';
import { createPendingPhoto } from '@/lib/pending-photos';

export const runtime = 'nodejs';

/**
 * Used by the LIFF form when a photo is taken with the in-app camera
 * capture (as opposed to one sent directly in chat, which the webhook
 * uploads itself). Uploads immediately on capture so the form only needs
 * to carry a small id through to submission, not the image bytes.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const photo = formData.get('photo');
  const lineUserId = formData.get('lineUserId');

  if (!(photo instanceof Blob) || typeof lineUserId !== 'string' || !lineUserId) {
    return NextResponse.json({ error: 'photo and lineUserId are required' }, { status: 400 });
  }

  const buffer = Buffer.from(await photo.arrayBuffer());
  const filename = photo instanceof File ? photo.name : 'photo.jpg';

  try {
    const id = await createPendingPhoto(buffer, filename, lineUserId);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error('Failed to upload pending photo:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
