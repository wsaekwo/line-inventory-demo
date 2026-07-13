// Run with: node scripts/setup-rich-menu.mjs
// Requires LINE_CHANNEL_ACCESS_TOKEN in env, and rich-menu-en.png +
// rich-menu-ja.png (both 2500x843) in this same scripts/ folder.
//
// Creates both language variants, uploads their images, and sets the
// Japanese one as the account-wide default (this is a Japan-based
// business — brand new followers whose language isn't known yet see
// Japanese first). The English variant gets linked to individual users
// at runtime by the webhook (see lib/rich-menu.ts) once their language
// is actually known — either from LINE's profile language field, or from
// them typing "English"/"日本語" to switch.
//
// Prints two richMenuId values at the end — put them in .env.local as
// RICH_MENU_ID_EN and RICH_MENU_ID_JA so the webhook can reference them.
//
// Re-run whenever you change the button layout for either language —
// LINE requires a fresh richMenuId per layout, menus aren't editable in
// place. Re-running creates new menus; delete the old ones from the
// console's Rich Menu list afterward if you don't need them.
import dotenv from 'dotenv';

dotenv.config({
  path: '.env.local',
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Set LINE_CHANNEL_ACCESS_TOKEN before running this script.');
  process.exit(1);
}

// The tap actions are identical between languages — only the artwork
// differs. "New Item" opens the LIFF form (which detects language itself);
// "Inventory" sends the same postback either way, the webhook resolves
// display language separately per user.
function menuDefinition(lang) {
  return {
    size: { width: 2500, height: 843 },
    selected: true,
    name: `main-menu-${lang}`,
    chatBarText: lang === 'ja' ? 'メニュー' : 'Menu',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 1250, height: 843 },
        action: { type: 'uri', uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}` },
      },
      {
        bounds: { x: 1250, y: 0, width: 1250, height: 843 },
        action: { type: 'postback', data: 'action=pick_store', displayText: lang === 'ja' ? '在庫確認' : 'Inventory' },
      },
    ],
  };
}

async function createAndUpload(lang) {
  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(menuDefinition(lang)),
  });
  const created = await createRes.json();
  if (!created.richMenuId) {
    console.error(`Failed to create ${lang} rich menu:`, created);
    process.exit(1);
  }
  const richMenuId = created.richMenuId;
  console.log(`Created ${lang} rich menu:`, richMenuId);

  const imagePath = path.join(__dirname, `rich-menu-${lang}.png`);
  if (!fs.existsSync(imagePath)) {
    console.warn(`No image found at ${imagePath} — menu created but has no image yet.`);
    return richMenuId;
  }
  const image = fs.readFileSync(imagePath);
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' },
    body: image,
  });
  if (!uploadRes.ok) {
    console.error(`Image upload failed for ${lang}:`, await uploadRes.text());
    process.exit(1);
  }
  console.log(`Uploaded ${lang} rich menu image.`);
  return richMenuId;
}

async function main() {
  const enId = await createAndUpload('en');
  const jaId = await createAndUpload('ja');

  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${jaId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!defaultRes.ok) {
    console.error('Failed to set Japanese menu as default:', await defaultRes.text());
    process.exit(1);
  }
  console.log('Set Japanese rich menu as the account-wide default.\n');

  console.log('Add these to .env.local (and your Netlify env vars):');
  console.log(`RICH_MENU_ID_EN=${enId}`);
  console.log(`RICH_MENU_ID_JA=${jaId}`);
}

main();
