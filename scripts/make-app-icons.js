// Regenerate Android launcher icons from the brand logo.
// Usage: node scripts/make-app-icons.js
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const SOURCE = path.resolve(__dirname, '../src/assets/logo-shield.png');
const RES_DIR = path.resolve(__dirname, '../android/app/src/main/res');

// Android launcher icon sizes per density bucket.
const DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const BG = { r: 255, g: 255, b: 255, alpha: 1 }; // white plate behind the logo

// A circular mask the size of the canvas (for the round icon variant).
const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );

async function buildIcon(size, round) {
  const pad = Math.round(size * 0.16); // breathing room around the logo
  const logo = await sharp(SOURCE)
    .resize(size - pad * 2, size - pad * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  let canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  }).composite([{ input: logo, gravity: 'center' }]);

  let out = await canvas.png().toBuffer();

  if (round) {
    out = await sharp(out)
      .composite([{ input: circleMask(size), blend: 'dest-in' }])
      .png()
      .toBuffer();
  }
  return out;
}

(async () => {
  if (!fs.existsSync(SOURCE)) {
    console.error('Source logo not found:', SOURCE);
    process.exit(1);
  }
  for (const [dir, size] of Object.entries(DENSITIES)) {
    const outDir = path.join(RES_DIR, dir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), await buildIcon(size, false));
    fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), await buildIcon(size, true));
    console.log(`✓ ${dir} (${size}px)`);
  }
  console.log('Done. Rebuild the APK to apply the new launcher icon.');
})();
