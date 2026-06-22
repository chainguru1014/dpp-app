const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WHITE = '#ffffff';
function wave(cx, cy, r, w) {
  const a = (55 * Math.PI) / 180;
  const x = (cx + r * Math.cos(a)).toFixed(1);
  const sy = (cy - r * Math.sin(a)).toFixed(1);
  const ey = (cy + r * Math.sin(a)).toFixed(1);
  return `<path d="M${x},${sy} A${r},${r} 0 0 1 ${x},${ey}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round"/>`;
}
// Borderless: just the Y + waves on a transparent background, tight square viewBox.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="95 92 312 312">
  <g stroke="${WHITE}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 175 L228 290" stroke-width="40"/>
    <path d="M306 175 L228 290" stroke-width="40"/>
    <path d="M228 285 L228 380" stroke-width="40"/>
  </g>
  ${wave(300, 168, 30, 17)}
  ${wave(300, 168, 54, 17)}
  ${wave(300, 168, 78, 17)}
</svg>`;

(async () => {
  const targets = [
    path.join(__dirname, '..', 'src', 'assets', 'logo-y-white.png'),
    path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'logo-y-white.png'),
  ];
  for (const t of targets) {
    await sharp(Buffer.from(svg), { density: 384 }).resize(512, 512).png().toFile(t);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'assets', 'logo-y-white.svg'), svg);
  console.log('white logo done');
})();
