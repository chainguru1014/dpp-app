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
// Bold typographic Y: flat (butt) ends, sharp mitred junction; thin delicate arcs.
function mark(color) {
  return `
  <g stroke="${color}" fill="none" stroke-width="44" stroke-linecap="butt" stroke-linejoin="miter">
    <path d="M156 162 L236 286"/>
    <path d="M316 162 L236 286"/>
    <path d="M236 282 L236 380"/>
  </g>
  ${wave(318, 146, 24, 15, color)}
  ${wave(318, 146, 46, 15, color)}
  ${wave(318, 146, 68, 15, color)}`;
}

// Generous padding so the Y sits smaller inside the round badge.
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 45 360 380">${mark(BLUE)}</svg>`;
const markWhiteSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 45 360 380">${mark('#ffffff')}</svg>`;
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
