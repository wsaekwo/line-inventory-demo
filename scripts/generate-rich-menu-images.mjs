// Run with: node scripts/generate-rich-menu-images.mjs
// Regenerates rich-menu-en.png and rich-menu-ja.png (2500x843 each) from
// the SVG definitions below — edit the text/colors/icons here, then
// re-run, rather than editing the PNGs directly. Also writes en.svg/ja.svg
// alongside the PNGs if you want to inspect or tweak the raw markup.
// Requires the `sharp` devDependency (already in package.json).
import sharp from 'sharp';
import fs from 'fs';

const W = 2500;
const H = 843;
const MID = W / 2;

const INK = '#0B0B0A';
const HAIRLINE = '#2E2A22';
const BRASS = '#B08D57';
const BRASS_LIGHT = '#D9BD8E';
const IVORY = '#EFE8DA';
const MUTED = '#A69C89';

// Simple outlined camera icon, centered at (cx, cy), roughly `s` px wide.
function cameraIcon(cx, cy, s) {
  const w = s, h = s * 0.72;
  const x = cx - w / 2, y = cy - h / 2;
  const bumpW = w * 0.32, bumpH = h * 0.22;
  const bumpX = cx - bumpW / 2, bumpY = y - bumpH * 0.6;
  const r = h * 0.28;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.14}" fill="none" stroke="${BRASS}" stroke-width="7"/>
    <rect x="${bumpX}" y="${bumpY}" width="${bumpW}" height="${bumpH}" rx="${bumpH * 0.25}" fill="none" stroke="${BRASS}" stroke-width="7"/>
    <circle cx="${cx}" cy="${cy + h * 0.03}" r="${r}" fill="none" stroke="${BRASS}" stroke-width="7"/>
    <circle cx="${cx}" cy="${cy + h * 0.03}" r="${r * 0.42}" fill="${BRASS}"/>
  `;
}

// Simple outlined package/box icon, centered at (cx, cy).
function boxIcon(cx, cy, s) {
  const w = s, h = s * 0.82;
  const x = cx - w / 2, y = cy - h / 2;
  const flapH = h * 0.32;
  return `
    <rect x="${x}" y="${y + flapH * 0.4}" width="${w}" height="${h - flapH * 0.4}" rx="${w * 0.03}" fill="none" stroke="${BRASS}" stroke-width="7"/>
    <path d="M ${x} ${y + flapH * 0.4} L ${cx} ${y} L ${x + w} ${y + flapH * 0.4}" fill="none" stroke="${BRASS}" stroke-width="7" stroke-linejoin="round"/>
    <line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + h - flapH * 0.4}" stroke="${BRASS}" stroke-width="6"/>
    <line x1="${x + w * 0.14}" y1="${cy + h * 0.06}" x2="${x + w * 0.86}" y2="${cy + h * 0.06}" stroke="${BRASS}" stroke-width="6" opacity="0.6"/>
  `;
}

function buildSvg({ leftKicker, leftLabel, leftCaption, rightKicker, rightLabel, rightCaption, serifFamily, sansFamily, italic }) {
  const leftCx = MID / 2;
  const rightCx = MID + MID / 2;
  const iconCy = H * 0.34;
  const iconSize = 190;
  const fontStyle = italic ? 'italic' : 'normal';

  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${INK}"/>

  <!-- divider -->
  <line x1="${MID}" y1="60" x2="${MID}" y2="${H - 60}" stroke="${HAIRLINE}" stroke-width="2"/>
  <circle cx="${MID}" cy="${H / 2}" r="9" fill="${INK}" stroke="${HAIRLINE}" stroke-width="2"/>

  <!-- left zone: New Item -->
  ${cameraIcon(leftCx, iconCy, iconSize)}
  <text x="${leftCx}" y="${H * 0.62}" text-anchor="middle" font-family="${sansFamily}" font-size="30" letter-spacing="6" fill="${BRASS}" font-weight="700">${leftKicker}</text>
  <text x="${leftCx}" y="${H * 0.75}" text-anchor="middle" font-family="${serifFamily}" font-style="${fontStyle}" font-size="72" fill="${IVORY}" font-weight="600">${leftLabel}</text>
  <text x="${leftCx}" y="${H * 0.86}" text-anchor="middle" font-family="${sansFamily}" font-size="28" fill="${MUTED}">${leftCaption}</text>

  <!-- right zone: Inventory -->
  ${boxIcon(rightCx, iconCy, iconSize)}
  <text x="${rightCx}" y="${H * 0.62}" text-anchor="middle" font-family="${sansFamily}" font-size="30" letter-spacing="6" fill="${BRASS}" font-weight="700">${rightKicker}</text>
  <text x="${rightCx}" y="${H * 0.75}" text-anchor="middle" font-family="${serifFamily}" font-style="${fontStyle}" font-size="72" fill="${IVORY}" font-weight="600">${rightLabel}</text>
  <text x="${rightCx}" y="${H * 0.86}" text-anchor="middle" font-family="${sansFamily}" font-size="28" fill="${MUTED}">${rightCaption}</text>

  <!-- brand mark -->
  <text x="${W / 2}" y="55" text-anchor="middle" font-family="${serifFamily}" font-style="${fontStyle}" font-size="30" fill="${BRASS_LIGHT}" opacity="0.85">${leftKicker === 'NEW ITEM' ? 'Appraisal Register' : '鑑定登録'}</text>
</svg>`;
}

const en = buildSvg({
  leftKicker: 'NEW ITEM',
  leftLabel: 'New Item',
  leftCaption: 'Photograph and register',
  rightKicker: 'INVENTORY',
  rightLabel: 'Inventory',
  rightCaption: 'Browse, sell, transfer',
  serifFamily: 'DejaVu Serif',
  sansFamily: 'DejaVu Sans',
  italic: true,
});

const ja = buildSvg({
  leftKicker: '新規登録',
  leftLabel: '新規登録',
  leftCaption: '写真を撮って登録',
  rightKicker: '在庫確認',
  rightLabel: '在庫確認',
  rightCaption: '閲覧・売却・移動',
  serifFamily: 'Noto Serif CJK JP',
  sansFamily: 'Noto Sans CJK JP',
  italic: false,
});

fs.writeFileSync('./scripts/en.svg', en);
fs.writeFileSync('./scripts/ja.svg', ja);

Promise.all([
  sharp(Buffer.from(en)).resize(W, H).flatten({ background: INK }).png().toFile('./scripts/rich-menu-en.png'),
  sharp(Buffer.from(ja)).resize(W, H).flatten({ background: INK }).png().toFile('./scripts/rich-menu-ja.png'),
]).then(() => console.log('done'));
