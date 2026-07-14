import { NextRequest, NextResponse } from 'next/server';
import { getLangOverride } from '@/lib/user-lang';

export const runtime = 'nodejs';

/**
 * Lets the LIFF form check whether someone has already told the bot
 * "English"/"日本語" — so the form matches that choice instead of always
 * falling back to the device's raw LINE language (liff.getLanguage()),
 * which knows nothing about a preference set through chat.
 */
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });
  }
  const lang = await getLangOverride(lineUserId);
  return NextResponse.json({ lang });
}
