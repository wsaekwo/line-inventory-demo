import { NextRequest, NextResponse } from 'next/server';
import { getPendingPhotoUrls } from '@/lib/pending-photos';

export const runtime = 'nodejs';

/** Resolves a pendingPhotoId to its viewable photo URLs, for the LIFF form's preview. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const urls = await getPendingPhotoUrls(params.id);
  return NextResponse.json({ urls });
}
