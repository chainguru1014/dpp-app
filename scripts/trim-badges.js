// Trims the transparent padding around the store badge PNGs so they fill their box.
// Run: node scripts/trim-badges.js
const path = require('path');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'src', 'assets');
const jobs = [
  ['App_Store_(iOS)-Badge-Alternative-Logo.wine.png', 'appstore-badge.png'],
  ['Google_Play-Badge-Logo.wine.png', 'googleplay-badge.png'],
];

(async () => {
  for (const [src, out] of jobs) {
    const meta = await sharp(path.join(assets, src))
      .trim({ threshold: 10 })
      .resize({ width: 600, withoutEnlargement: true })
      .png()
      .toFile(path.join(assets, out));
    console.log(out, meta.width + 'x' + meta.height);
  }
})().catch((e) => { console.error(e); process.exit(1); });
