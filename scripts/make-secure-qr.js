// Generates a crisp, brand-coloured "secure QR" image (QR + centered padlock badge).
// Same meaning as the old Screenshot_9.png, but sharp and on-theme.
// Run: node scripts/make-secure-qr.js
const path = require('path');
const QRCode = require('qrcode');
const sharp = require('sharp');

const PRIMARY = '#3d5c93';
const NAVY = '#1f3361';
const SIZE = 600;
const OUT = path.join(__dirname, '..', 'src', 'assets', 'qr-secure.png');

// Clean padlock + white badge, drawn as SVG and composited over the QR center.
const badge = `
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <circle cx="300" cy="300" r="120" fill="#ffffff"/>
  <circle cx="300" cy="300" r="120" fill="none" stroke="${PRIMARY}" stroke-opacity="0.12" stroke-width="6"/>
  <!-- shackle -->
  <path d="M262 300 V268 a38 38 0 0 1 76 0 V300"
        fill="none" stroke="${NAVY}" stroke-width="18" stroke-linecap="round"/>
  <!-- body -->
  <rect x="250" y="296" width="100" height="86" rx="16" fill="${NAVY}"/>
  <!-- keyhole -->
  <circle cx="300" cy="330" r="12" fill="#ffffff"/>
  <rect x="294" y="332" width="12" height="26" rx="6" fill="#ffffff"/>
</svg>`;

(async () => {
  const qrPng = await QRCode.toBuffer('https://yometel.com', {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: SIZE,
    color: { dark: PRIMARY, light: '#ffffff' },
  });

  await sharp(qrPng)
    .composite([{ input: Buffer.from(badge), gravity: 'center' }])
    .png()
    .toFile(OUT);

  console.log('Wrote', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
