const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BLUE = '#34589b';
const ASSETS = path.join(__dirname, '..', 'src', 'assets');

// Concentric signal arcs, opening right, centred at (cx,cy).
function wave(cx, cy, r, w, color) {
  const a = (52 * Math.PI) / 180;
  const x = (cx + r * Math.cos(a)).toFixed(1);
  const sy = (cy - r * Math.sin(a)).toFixed(1);
  const ey = (cy + r * Math.sin(a)).toFixed(1);
  return `<path d="M${x},${sy} A${r},${r} 0 0 1 ${x},${ey}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
}

// The Y + waves mark, drawn with the given colour. No background.
function mark(color) {
  return `
  <g stroke="${color}" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 165 L235 295" stroke-width="48"/>
    <path d="M300 175 L235 295" stroke-width="48"/>
    <path d="M235 290 L235 380" stroke-width="48"/>
  </g>
  ${wave(322, 150, 24, 16, color)}
  ${wave(322, 150, 46, 16, color)}
  ${wave(322, 150, 68, 16, color)}`;
}

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 80 392 360">${mark(BLUE)}</svg>`;
const markWhiteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 80 392 360">${mark('#ffffff')}</svg>`;
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="#ffffff"/>
  ${mark(BLUE)}
</svg>`;

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 }).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

(async () => {
  fs.writeFileSync(path.join(ASSETS, 'logo-y.png'), await png(tileSvg, 512));        // white tile (favicon/home)
  fs.writeFileSync(path.join(ASSETS, 'logo-y-mark.png'), await png(markSvg, 512));    // transparent blue mark (badges)
  fs.writeFileSync(path.join(ASSETS, 'logo-y-white.png'), await png(markWhiteSvg, 512)); // transparent white mark
  fs.writeFileSync(path.join(ASSETS, 'favicon.png'), await png(tileSvg, 64));
  fs.writeFileSync(path.join(ASSETS, 'logo-y.svg'), tileSvg);
  fs.writeFileSync(path.join(ASSETS, 'logo-y-mark.svg'), markSvg);
  fs.writeFileSync(path.join(ASSETS, 'logo-y-white.svg'), markWhiteSvg);
  console.log('logos done');
})();
