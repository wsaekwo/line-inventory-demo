import { getPocketBase } from './pocketbase';
import type { Lang } from './i18n';

/**
 * Create a `user_prefs` collection in PocketBase with:
 *   lineUserId    text
 *   lang          text (or select: en / ja)
 *
 * Same API rules recommendation as `items`/`staff`: leave
 * List/View/Create/Update blank (superusers only).
 *
 * Only written to when someone explicitly types "English" or "日本語" in
 * chat (see app/api/webhook/route.ts) — otherwise language is left to
 * auto-detection and this collection stays empty for that person. Read
 * from both the bot (lib/bot-lang.ts) and the LIFF form
 * (app/api/lang/route.ts), so a manual switch applies everywhere, not
 * just to chat replies.
 */
const COLLECTION = 'user_prefs';

export async function getLangOverride(lineUserId: string): Promise<Lang | null> {
  const pb = await getPocketBase();
  try {
    const record = await pb
      .collection(COLLECTION)
      .getFirstListItem(pb.filter('lineUserId = {:id}', { id: lineUserId }));
    const lang = record.lang as string;
    return lang === 'en' || lang === 'ja' ? lang : null;
  } catch {
    return null;
  }
}

export async function setLangOverride(lineUserId: string, lang: Lang): Promise<void> {
  const pb = await getPocketBase();
  try {
    const existing = await pb
      .collection(COLLECTION)
      .getFirstListItem(pb.filter('lineUserId = {:id}', { id: lineUserId }));
    await pb.collection(COLLECTION).update(existing.id, { lang });
  } catch {
    await pb.collection(COLLECTION).create({ lineUserId, lang });
  }
}
