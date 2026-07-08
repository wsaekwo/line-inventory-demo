import PocketBase from 'pocketbase';

/**
 * One client instance, reused across requests. Authenticates as a
 * superuser (if credentials are set) so it can read/write regardless of
 * collection API rules — recommended for a backend-only integration like
 * this webhook, since staff never call PocketBase directly themselves.
 *
 * If you'd rather not use a superuser account, leave POCKETBASE_ADMIN_EMAIL/
 * PASSWORD unset and instead open up the "items" collection's API rules
 * (List/View/Create/Update) in the PocketBase dashboard — but then anyone
 * with the collection URL could read/write it, so the superuser route is
 * the safer default for an internal tool.
 */
let client: PocketBase | null = null;
let authPromise: Promise<void> | null = null;

export async function getPocketBase(): Promise<PocketBase> {
  if (!client) {
    const rawUrl = process.env.POCKETBASE_URL;
    if (!rawUrl) throw new Error('POCKETBASE_URL is not set');
    // Guards against the common mistake of copying the dashboard URL
    // (which ends in /_/) instead of the bare API origin.
    const url = rawUrl.replace(/\/_\/?$/, '').replace(/\/$/, '');
    client = new PocketBase(url);
    client.autoCancellation(false);
  }

  const email = process.env.POCKETBASE_ADMIN_EMAIL;
  const password = process.env.POCKETBASE_ADMIN_PASSWORD;

  if (email && password && !client.authStore.isValid) {
    if (!authPromise) {
      // The installed SDK version may internally route pb.admins.* to the
      // newer _superusers endpoint regardless of the method name, which
      // won't work against a pre-0.23 server. Hitting the legacy endpoint
      // directly with a raw request sidesteps that ambiguity entirely.
      authPromise = (async () => {
        const res = await fetch(`${client!.baseUrl}/api/admins/auth-with-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: email, password }),
        });
        if (!res.ok) {
          throw new Error(`PocketBase admin auth failed: ${res.status} ${await res.text()}`);
        }
        const data = await res.json();
        client!.authStore.save(data.token, data.admin);
      })();
    }
    await authPromise;
    authPromise = null;
  }

  return client;
}
