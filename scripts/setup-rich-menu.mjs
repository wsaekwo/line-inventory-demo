// Run with: node scripts/setup-rich-menu.mjs
// Requires LINE_CHANNEL_ACCESS_TOKEN in env and a rich-menu.png (2500x1686 or 2500x843)
// placed at scripts/rich-menu.png before running.
//
// This creates the menu definition (button zones), uploads the image, and
// sets it as the default menu for every user of the Official Account.
// Re-run whenever you change the button layout — LINE requires a fresh
// richMenuId each time, you can't edit one in place.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Set LINE_CHANNEL_ACCESS_TOKEN before running this script.');
  process.exit(1);
}

const richMenuDefinition = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'main-menu',
  chatBarText: 'Menu',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: 'uri', uri: `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}` },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: 'postback', data: 'action=pick_store', displayText: 'Inventory' },
    },
  ],
};

async function main() {
  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(richMenuDefinition),
  });
  const created = await createRes.json();
  if (!created.richMenuId) {
    console.error('Failed to create rich menu:', created);
    process.exit(1);
  }
  const richMenuId = created.richMenuId;
  console.log('Created rich menu:', richMenuId);

  const imagePath = path.join(__dirname, 'rich-menu.png');
  if (!fs.existsSync(imagePath)) {
    console.warn(
      `No image found at ${imagePath}. Menu created but not usable until an image is uploaded — ` +
        `add a 2500x843px PNG there and re-run.`
    );
    return;
  }
  const image = fs.readFileSync(imagePath);
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'image/png' },
    body: image,
  });
  if (!uploadRes.ok) {
    console.error('Image upload failed:', await uploadRes.text());
    process.exit(1);
  }
  console.log('Uploaded rich menu image.');

  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!defaultRes.ok) {
    console.error('Failed to set as default:', await defaultRes.text());
    process.exit(1);
  }
  console.log('Set as default rich menu for all users. Done.');
}

main();
