const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const svg = fs.readFileSync(path.join(__dirname, '..', 'src', 'assets', 'logo-y.svg'));
const FE = path.join(__dirname, '..', '..', 'frontend');

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
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

async function png(size) {
  return sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
}

(async () => {
  fs.writeFileSync(path.join(FE, 'src', 'assets', 'logo-y.png'), await png(512));
  fs.writeFileSync(path.join(FE, 'public', 'logo512.png'), await png(512));
  fs.writeFileSync(path.join(FE, 'public', 'logo192.png'), await png(192));
  fs.writeFileSync(path.join(FE, 'public', 'favicon-shield.png'), await png(64));
  fs.writeFileSync(path.join(FE, 'public', 'favicon.ico'), pngToIco(await png(64), 64));
  console.log('frontend logos done');
})();
