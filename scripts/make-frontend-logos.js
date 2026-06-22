const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'src', 'assets');
const tileSvg = fs.readFileSync(path.join(ASSETS, 'logo-y.svg'));        // white tile
const whiteSvg = fs.readFileSync(path.join(ASSETS, 'logo-y-white.svg')); // transparent white mark
const FE = path.join(__dirname, '..', '..', 'frontend');

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}
async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
}

(async () => {
  // Brand logo assets used by the admin UI
  fs.writeFileSync(path.join(FE, 'src', 'assets', 'logo-y.png'), await png(tileSvg, 512));
  fs.writeFileSync(path.join(FE, 'src', 'assets', 'logo-y-white.png'), await png(whiteSvg, 512));
  // Favicon / home-screen icons (the screenshot-1 tile)
  fs.writeFileSync(path.join(FE, 'public', 'logo512.png'), await png(tileSvg, 512));
  fs.writeFileSync(path.join(FE, 'public', 'logo192.png'), await png(tileSvg, 192));
  fs.writeFileSync(path.join(FE, 'public', 'favicon-shield.png'), await png(tileSvg, 64));
  fs.writeFileSync(path.join(FE, 'public', 'favicon.ico'), pngToIco(await png(tileSvg, 64), 64));
  console.log('frontend logos done');
})();
