import { lineClient } from './line';
import { normalizeLang, type Lang } from './i18n';

/**
 * LINE's Get Profile API includes a `language` field (BCP 47, e.g. "en"),
 * but only once the user has consented to LINE's Privacy Policy — it's
 * absent otherwise. Falls back to DEFAULT_LANG (Japanese) when missing or
 * the lookup fails, which fits this being a Japan-based business.
 */
export async function getUserLanguage(userId: string): Promise<Lang> {
  try {
    const profile = await lineClient.getProfile(userId);
    return normalizeLang((profile as { language?: string }).language);
  } catch {
    return normalizeLang(undefined);
  }
}
