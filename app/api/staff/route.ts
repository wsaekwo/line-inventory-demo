import { NextRequest, NextResponse } from 'next/server';
import { getStaffStore } from '@/lib/staff';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });
  }
  const store = await getStaffStore(lineUserId);
  return NextResponse.json({ store });
}
