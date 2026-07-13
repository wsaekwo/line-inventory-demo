import { lineClient } from './line';
import type { Lang } from './i18n';

/**
 * Assigns the English or Japanese rich menu to one specific user, overriding
 * whatever the account-wide default is for them. The default (set by
 * scripts/setup-rich-menu.mjs) is Japanese — this only needs to run for
 * people who should see something different, which in practice means:
 * anyone resolved as English (see lib/bot-lang.ts), and anyone who
 * switches language explicitly via the "English"/"日本語" chat command.
 *
 * Silently does nothing if RICH_MENU_ID_EN/JA aren't set yet (e.g. the
 * setup script hasn't been run) — a missing rich menu link is a cosmetic
 * problem, not one worth blocking a chat reply over.
 */
export async function linkRichMenuForLang(userId: string, lang: Lang): Promise<void> {
  const richMenuId = lang === 'en' ? process.env.RICH_MENU_ID_EN : process.env.RICH_MENU_ID_JA;
  if (!richMenuId) return;

  try {
    await lineClient.linkRichMenuToUser(userId, richMenuId);
  } catch (err) {
    console.error(`Failed to link ${lang} rich menu to user:`, err);
  }
}
