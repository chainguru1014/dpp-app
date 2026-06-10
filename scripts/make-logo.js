// Builds the app logo:
//  1. Strips the white background out of logo.ico  -> logo-clean.png (transparent)
//  2. Composites that blue Yometel mark inside a white shield -> logo-shield.png
// Run: node scripts/make-logo.js
const path = require('path');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'src', 'assets');
const src = path.join(assets, 'logo.ico');
const cleanOut = path.join(assets, 'logo-clean.png');
const shieldOut = path.join(assets, 'logo-shield.png');

const SIZE = 320; // shield render size (px), viewBox is 0..48

const shieldSvg = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 3 L41.5 9.5
           C42.4 9.8 43 10.7 43 11.7 L43 24
           C43 34 35.8 41.4 24 45.5
           C12.2 41.4 5 34 5 24 L5 11.7
           C5 10.7 5.6 9.8 6.5 9.5 Z"
        fill="#ffffff" stroke="#2f4c95" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`;

(async () => {
  // 1. Knock the white background out of logo.ico, keeping the blue mark.
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.min(data[i], data[i + 1], data[i + 2]); // "lightness" proxy
    let a;
    if (m >= 235) a = 0; // white -> transparent
    else if (m <= 170) a = 255; // solid mark -> opaque
    else a = Math.round(((235 - m) / 65) * 255); // feather the edge
    data[i + 3] = a;
  }
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(cleanOut);
  console.log('logo-clean.png', width + 'x' + height);

  // 2. Trim the transparent margin, then composite inside the shield.
  const mark = await sharp(cleanOut)
    .trim({ threshold: 5 })
    .resize({ height: Math.round(SIZE * 0.42), withoutEnlargement: false }) // fit inside shield
    .toBuffer({ resolveWithObject: true });

  const markW = mark.info.width;
  const markH = mark.info.height;
  // Shield interior centre (viewBox ~ (24, 23.5)) scaled to px.
  const cx = Math.round((24 / 48) * SIZE);
  const cy = Math.round((23.5 / 48) * SIZE);

  await sharp(Buffer.from(shieldSvg))
    .composite([{ input: mark.data, left: cx - Math.round(markW / 2), top: cy - Math.round(markH / 2) }])
    .png()
    .toFile(shieldOut);
  console.log('logo-shield.png', SIZE + 'x' + SIZE, 'mark', markW + 'x' + markH);
})().catch((e) => { console.error(e); process.exit(1); });
