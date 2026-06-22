const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'src', 'assets', 'qr-secure.png');
const AZURE = [47, 128, 200];   // #2f80c8 brand blue
const DARK  = [29, 90, 153];    // #1d5a99 darker azure (lock)
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

(async () => {
  const img = sharp(SRC);
  const { width, height } = await img.metadata();
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels; // 4
  for (let i = 0; i < data.length; i += ch) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const d = 1 - lum;               // 0 = white, larger = darker ink
    let out;
    if (d <= 0.66) {                 // white -> azure (covers modules + anti-aliasing)
      const t = d / 0.66;
      out = [lerp(255, AZURE[0], t), lerp(255, AZURE[1], t), lerp(255, AZURE[2], t)];
    } else {                         // azure -> dark azure (the lock)
      const t = Math.min(1, (d - 0.66) / 0.34);
      out = [lerp(AZURE[0], DARK[0], t), lerp(AZURE[1], DARK[1], t), lerp(AZURE[2], DARK[2], t)];
    }
    data[i] = out[0]; data[i + 1] = out[1]; data[i + 2] = out[2];
  }
  await sharp(data, { raw: { width, height, channels: ch } }).png().toFile(SRC);
  console.log('recolored qr-secure.png');
})();
