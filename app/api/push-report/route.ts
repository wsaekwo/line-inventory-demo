import { NextRequest, NextResponse } from 'next/server';
import { fullSalesReport } from '@/lib/db';
import { pushFlex } from '@/lib/line';
import { salesReportCarousel } from '@/lib/messages';

export const runtime = 'nodejs';

/**
 * Pushes a sales report (all-stores total + per-store breakdown) to every
 * configured owner. Call this on a schedule rather than by hand — see the
 * README for a GitHub Actions cron example.
 *
 * Query param: ?period=weekly (default, 7 days) or ?period=monthly (30 days).
 *
 * Protected by CRON_SECRET, sent as an `x-cron-secret` header. If
 * CRON_SECRET isn't set, the endpoint still runs (handy while testing
 * locally) but logs a warning — set it before pointing a public scheduler
 * at this, or anyone who finds the URL can trigger pushes to your owners.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get('x-cron-secret') !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('CRON_SECRET is not set — /api/push-report is unauthenticated.');
  }

  const period = req.nextUrl.searchParams.get('period');
  const days = period === 'monthly' ? 30 : 7;

  const ownerIds = (process.env.OWNER_LINE_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ownerIds.length === 0) {
    return NextResponse.json({ error: 'No OWNER_LINE_USER_IDS configured' }, { status: 400 });
  }

  const report = await fullSalesReport(days);
  const message = salesReportCarousel(report);

  await Promise.all(ownerIds.map((id) => pushFlex(id, message.altText, message.contents)));

  return NextResponse.json({ ok: true, report });
}
