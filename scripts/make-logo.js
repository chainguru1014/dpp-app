const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BLUE = '#34589b';
const ASSETS = path.join(__dirname, '..', 'src', 'assets');

function wave(cx, cy, r, w) {
  const a = (55 * Math.PI) / 180;
  const sx = (cx + r * Math.cos(a)).toFixed(1);
  const sy = (cy - r * Math.sin(a)).toFixed(1);
  const ex = (cx + r * Math.cos(a)).toFixed(1);
  const ey = (cy + r * Math.sin(a)).toFixed(1);
  return `<path d="M${sx},${sy} A${r},${r} 0 0 1 ${ex},${ey}" fill="none" stroke="${BLUE}" stroke-width="${w}" stroke-linecap="round"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="44" y="44" width="424" height="424" rx="108" ry="108" fill="#ffffff" stroke="${BLUE}" stroke-width="14"/>
  <g stroke="${BLUE}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 175 L228 290" stroke-width="40"/>
    <path d="M306 175 L228 290" stroke-width="40"/>
    <path d="M228 285 L228 380" stroke-width="40"/>
  </g>
  ${wave(300, 168, 30, 17)}
  ${wave(300, 168, 54, 17)}
  ${wave(300, 168, 78, 17)}
</svg>`;

(async () => {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 384 }).resize(512, 512).png().toFile(path.join(ASSETS, 'logo-y.png'));
  await sharp(buf, { density: 384 }).resize(64, 64).png().toFile(path.join(ASSETS, 'favicon.png'));
  fs.writeFileSync(path.join(ASSETS, 'logo-y.svg'), svg);
  console.log('done');
})();
