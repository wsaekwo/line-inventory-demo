# LINE Inventory Register — working demo

LIFF registration form + Messaging API webhook, wired together. Photo → structured
form → appraisal-ticket confirmation pushed back into the LINE chat.

## What's real vs. stubbed

- **Real**: webhook signature verification, event handling (image/text/postback/follow),
  LIFF profile resolution, form → API → push-confirmation round trip, rich menu
  setup script, the menu/inventory/sell/transfer chat flows, PocketBase-backed
  storage — including photos, which are actually persisted as files in
  PocketBase, not base64 text.
- **Not built yet**: no automatic cleanup for abandoned `pending_photos` rows
  (someone sends a photo, never finishes registering it) — they'll sit unused
  indefinitely. Fine at pilot volume; worth a periodic cleanup job later.

## Photo flow

A photo can enter the system two ways, and both end up in the same place:

- Sent directly in chat → the webhook downloads it from LINE and uploads it
  to a `pending_photos` record immediately, then replies with a LIFF link
  carrying that record's id.
- Taken with the LIFF form's own camera capture → uploaded the moment it's
  captured, same `pending_photos` collection.

Either way, the form only ever carries a small `pendingPhotoId` around, not
the image itself. On submit, that pending photo is copied onto the new
`items` record and the `pending_photos` row is deleted — `pending_photos` is
meant to be transient, `items` permanent.

**Why the `photo` field is left unprotected.** PocketBase file access is
controlled per-field (a "Protected" toggle), separately from a collection's
List/View API rules — a file can be fetchable by direct URL even when the
record itself requires a superuser to read. This project deliberately
leaves `photo` unprotected on both collections, because LINE's own servers
need to fetch the image directly for Flex Message hero images (item cards,
confirmation tickets) and can't do that through a short-lived auth token
minted per push. PocketBase appends a random suffix to every filename, so
the URL isn't guessable — reasonable for a pilot, worth revisiting (e.g.
tokened URLs generated per-push instead) before handling anything sensitive.

## PocketBase setup

1. Run PocketBase (self-hosted binary, Fly.io, PocketHost.io, etc.) and create
   your first superuser: `./pocketbase superuser create you@example.com yourpassword`
2. In the PocketBase dashboard, create a collection named **`items`** with:
   | field | type |
   |---|---|
   | category | text (or select, matching `CATEGORIES` in `lib/schema.ts`: Bags / Watches / Jewelry / Accessories) |
   | brand | text |
   | productName | text |
   | price | number |
   | condition | text (or select: S / A / B / C) |
   | store | text (or select, matching `STORES` in `lib/schema.ts`) |
   | status | text (or select: in_stock / sold) |
   | notes | text, optional |
   | lineUserId | text |
   | photo | file, optional — leave **Protected** unchecked (see "Photo flow" above) |
   | soldAt | text, optional (ISO date string, set automatically when marked sold) |

   `id` and `created` are automatic — `created` doubles as `registeredAt`.
3. Create a second collection named **`staff`** (optional, but skips asking
   "which store?" for known staff on the registration form):
   | field | type |
   |---|---|
   | lineUserId | text |
   | store | text (or select, matching `STORES`) |
   | displayName | text, optional |

   Add a row per staff member once you have their LINE userId — same "id"/
   "myid" chat trick works for staff as it does for owners. Not required:
   with no matching row, the form just falls back to asking which store.
4. Create a third collection named **`pending_photos`**:
   | field | type |
   |---|---|
   | photo | file — leave **Protected** unchecked, same reasoning as `items.photo` |
   | lineUserId | text |
5. Leave all three collections' **List/View/Create/Update API rules blank**
   (superusers only). This app authenticates as a superuser (see
   `lib/pocketbase.ts`), so nothing else needs public access to the
   *records* — this is separate from the `photo` fields' unprotected file
   access described above.
6. Set `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`
   in `.env.local`.

## 1. Install

```bash
npm install
```

## 2. Configure LINE

You said you already have credentials — here's exactly where they plug in.

1. In the **LINE Developers Console**, open your Messaging API channel.
2. Copy the **Channel access token** (issue a long-lived one under
   Messaging API tab) and **Channel secret** (Basic settings tab) into
   `.env.local` (copy `.env.example` first).
3. LINE no longer allows adding a LIFF app directly to a Messaging API
   channel (removed in 2020). Instead, on the same **provider** (e.g. your
   "Wellna" provider), create a second channel of type **LINE Login** —
   App type: Web app. Creating it under the same provider as your
   Messaging API channel is what matters: LINE guarantees the same user
   gets the same `userId` across both, so no separate linking step is
   needed for this app's purposes.
4. In that LINE Login channel's **LIFF** tab, add a LIFF app:
   - Endpoint URL: `https://<your-deployed-domain>/register` (use an ngrok
     URL for local testing, e.g. `https://abcd1234.ngrok.io/register`)
   - Size: `Full`
   - Scopes: `profile`
5. Copy the generated LIFF ID into `NEXT_PUBLIC_LIFF_ID`.

## 3. Run locally

```bash
npm run dev
```

The webhook needs a public HTTPS URL for LINE to reach it, so for local
testing tunnel it:

```bash
ngrok http 3000
```

Then in the console, set the **Webhook URL** (Messaging API tab) to
`https://<ngrok-domain>/api/webhook` and turn "Use webhook" on. Use the
**Verify** button there to confirm the signature check in
`app/api/webhook/route.ts` is passing.

## 4. Try the flow

1. Add the Official Account as a friend (QR code is in the console) — you'll
   get the menu (New Item / Inventory) right away.
2. **New Item**: send a photo in chat, or tap the menu button → picks a
   category (Bags/Watches/Jewelry/Accessories) → fills out
   brand/price/condition/store → submits → a ticket-style confirmation card
   pushes back into the chat. If the sender has a matching row in the
   `staff` collection, store is pre-filled (still editable) instead of
   blank.
3. **Inventory**: tap the menu button → pick a store → pick a category (or
   "All") → see its in-stock items as swipeable cards, each with **Sold**
   and **Transfer** buttons. Transfer asks which destination store
   (excluding the current one) and moves the item there — still in stock,
   just relocated.
4. Any typed message (not a button tap) brings the menu back up — except
   the words **"id"** or **"myid"**, which reply with the sender's own LINE
   userId. That's the easiest way for an owner to get their ID for
   `OWNER_LINE_USER_IDS`: have them message the bot that word once.

## 5. Rich menu (the "New Item / Inventory" buttons)

```bash
# put a 2500x843px PNG at scripts/rich-menu.png first
LINE_CHANNEL_ACCESS_TOKEN=xxx NEXT_PUBLIC_LIFF_ID=xxx npm run setup-rich-menu
```

Re-run this any time you change button positions — LINE requires a new
`richMenuId` per layout, menus aren't editable in place.

## 6. Sales reports

`POST /api/push-report` pushes an all-stores total plus a per-store
breakdown (new items, sold count, revenue, and a simple bar comparing
revenue across stores) to everyone in `OWNER_LINE_USER_IDS`.

```bash
# weekly (default, last 7 days)
curl -X POST https://<your-domain>/api/push-report \
  -H "x-cron-secret: <your CRON_SECRET>"

# monthly (last 30 days)
curl -X POST "https://<your-domain>/api/push-report?period=monthly" \
  -H "x-cron-secret: <your CRON_SECRET>"
```

This isn't triggered automatically — wire it to a scheduler. A GitHub
Actions workflow is the simplest option since the project's already on
GitHub (`.github/workflows/weekly-report.yml`):

```yaml
name: Weekly sales report
on:
  schedule:
    - cron: '0 9 * * 1' # 9am UTC every Monday — adjust for JST if needed
  workflow_dispatch: {} # lets you trigger it manually from the Actions tab too

jobs:
  push-report:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.APP_URL }}/api/push-report" \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

Add `APP_URL` and `CRON_SECRET` under the repo's **Settings → Secrets and
variables → Actions**. Swap the `cron` schedule's day/hour for monthly, or
just add a second job with `?period=monthly` on a `0 9 1 * *` schedule
(first of the month).

## 7. Deploy

Deployed via Netlify (connected to your GitHub repo, auto-detects Next.js
through `netlify.toml` / `@netlify/plugin-nextjs`). After deploying:

- Update the LIFF Endpoint URL (on the LINE Login channel's LIFF tab) to the
  real production URL.
- Update the Messaging API Webhook URL to `https://<prod-domain>/api/webhook`.
- Set `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `NEXT_PUBLIC_LIFF_ID`,
  `POCKETBASE_URL`, `POCKETBASE_ADMIN_EMAIL`, `POCKETBASE_ADMIN_PASSWORD`, and
  `OWNER_LINE_USER_IDS` as Netlify environment variables. Your PocketBase
  instance needs to be reachable from the public internet (not `localhost`)
  once deployed — same as when you were pointing at it via ngrok locally, but
  now permanently, so a self-hosted VPS or PocketHost.io URL rather than a
  tunnel.

## Where things live

```
app/api/webhook/route.ts     bot backend — receives LINE events, drives the menu/inventory/sell/transfer flows
app/api/inventory/route.ts   LIFF form posts here; pushes confirmation card
app/api/staff/route.ts       looks up a staff member's store, for form pre-fill
app/api/pending-photo/route.ts       upload endpoint for in-form camera capture
app/api/pending-photo/[id]/route.ts  resolves a pendingPhotoId to a preview URL
app/api/push-report/route.ts sales report push (weekly/monthly), trigger via the GH Actions workflow below
app/register/page.tsx        the LIFF form itself
lib/line.ts                  Messaging API client + signature verification
lib/liff-client.ts           client-side LIFF init / profile hook
lib/pocketbase.ts            PocketBase client + superuser auth
lib/staff.ts                 looks up a staff member's store from the staff collection
lib/pending-photos.ts         create/lookup/delete for photos in transit before an item exists
lib/db.ts                    data access (listItems, createItem, sellItem, transferItem, periodSummary, etc.)
lib/messages.ts              LINE message builders — menu, store quick-reply, item carousel, sales report
lib/schema.ts                shared Zod schema (form + API validate the same shape)
scripts/setup-rich-menu.mjs  one-time rich menu creation/upload
.github/workflows/weekly-report.yml  scheduled trigger for the sales report
```
