import { NextRequest, NextResponse } from 'next/server';
import { getPendingPhotoUrl } from '@/lib/pending-photos';

export const runtime = 'nodejs';

/** Resolves a pendingPhotoId to a viewable URL, for the LIFF form's preview. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const url = await getPendingPhotoUrl(params.id);
  if (!url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ url });
}
