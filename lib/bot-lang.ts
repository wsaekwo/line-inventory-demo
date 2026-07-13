import { lineClient } from './line';
import { normalizeLang, type Lang } from './i18n';
import { getLangOverride } from './user-lang';

/**
 * Resolves in this order:
 *  1. A manual override (someone typed "English"/"日本語" in chat — see
 *     app/api/webhook/route.ts) — always wins once set, regardless of what
 *     LINE reports next.
 *  2. LINE's Get Profile API `language` field (BCP 47, e.g. "en"), present
 *     only once the user has consented to LINE's Privacy Policy.
 *  3. DEFAULT_LANG (Japanese) if neither is available.
 */
export async function getUserLanguage(userId: string): Promise<Lang> {
  const override = await getLangOverride(userId);
  if (override) return override;

  try {
    const profile = await lineClient.getProfile(userId);
    return normalizeLang((profile as { language?: string }).language);
  } catch {
    return normalizeLang(undefined);
  }
}
