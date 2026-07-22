// Dependency-free EAN-13 barcode reader: decodes a horizontal scan line of
// binarized pixels into a 13-digit value, checksum-verified. Written for the
// web photo-upload scan path (see ScannerScreen.decodeImageFromFile), which
// already has ImageData from jsQR's canvas but no 1D-barcode decode
// capability — npm's registry was unreachable in this environment when a
// real barcode-reading library (e.g. @zxing/library) was needed, so this
// hand-rolled reader exists instead. The bar-pattern tables are the exact
// same ones ported (and verified against `python-barcode`'s source) for
// frontend/src/utils/barcodeRenderer.js's EAN-13 *encoder* — this is that
// same table run in reverse. Tested against an actual generated barcode PNG
// before being wired in (decoded correctly).
//
// Deliberately scoped to clean, axis-aligned, high-contrast images (our own
// generated test barcodes, or a straight-on photo of a printed one) — no
// rotation/perspective correction, unlike a full barcode-reading library.
const EDGE = '101';
const MIDDLE = '01010';
const CODES: Record<'A' | 'B' | 'C', string[]> = {
  A: ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'],
  B: ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'],
  C: ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'],
};
const LEFT_PATTERN = [
  'AAAAAA', 'AABABB', 'AABBAB', 'AABBBA', 'ABAABB',
  'ABBAAB', 'ABBBAA', 'ABABAB', 'ABABBA', 'ABBABA',
];

const REVERSE: Record<string, number> = {};
(['A', 'B', 'C'] as const).forEach((table) => {
  CODES[table].forEach((pattern, digit) => {
    REVERSE[`${table}:${pattern}`] = digit;
  });
});

type Run = { color: 0 | 1; length: number };

const runLengths = (bits: (0 | 1)[]): Run[] => {
  const runs: Run[] = [];
  let cur = bits[0];
  let len = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === cur) {
      len++;
    } else {
      runs.push({ color: cur, length: len });
      cur = bits[i];
      len = 1;
    }
  }
  runs.push({ color: cur, length: len });
  return runs;
};

// Converts a group of runs (given a calibrated module width) into a modules
// bit string — e.g. runs of widths [2,1,3,1] at unit=1 -> "1101111"-shaped —
// or null if the total module count doesn't match what's expected.
const runsToModuleString = (runs: Run[], unit: number, expectedModules: number): string | null => {
  let str = '';
  for (const r of runs) {
    const modules = Math.round(r.length / unit);
    if (modules < 1) return null;
    str += (r.color ? '1' : '0').repeat(modules);
  }
  return str.length === expectedModules ? str : null;
};

const checksumValid = (value: string): boolean => {
  const base = value.slice(0, 12);
  let evensum = 0;
  let oddsum = 0;
  for (let k = 0; k < 12; k++) {
    const d = Number(base[k]);
    if ((12 - k) % 2 === 0) evensum += d;
    else oddsum += d;
  }
  const check = (10 - ((evensum + oddsum * 3) % 10)) % 10;
  return check === Number(value[12]);
};

const decodeRow = (bits: (0 | 1)[]): string | null => {
  const runs = runLengths(bits);

  for (let i = 0; i < runs.length - 3; i++) {
    if (runs[i].color !== 1) continue; // start guard begins with a bar
    const g1 = runs[i], g2 = runs[i + 1], g3 = runs[i + 2];
    if (g2.color !== 0 || g3.color !== 1) continue;
    const unit = (g1.length + g2.length + g3.length) / 3;
    if (Math.abs(g1.length - unit) > unit * 0.5) continue;
    if (Math.abs(g2.length - unit) > unit * 0.5) continue;
    if (Math.abs(g3.length - unit) > unit * 0.5) continue;

    let pos = i + 3;
    let leftPatternKey = '';
    const leftDigits: number[] = [];
    let ok = true;

    for (let d = 0; d < 6; d++) {
      if (pos + 4 > runs.length) { ok = false; break; }
      const group = runs.slice(pos, pos + 4);
      const bitStr = runsToModuleString(group, unit, 7);
      if (!bitStr) { ok = false; break; }
      let matched: { table: 'A' | 'B'; digit: number } | null = null;
      for (const table of ['A', 'B'] as const) {
        const digit = REVERSE[`${table}:${bitStr}`];
        if (digit !== undefined) { matched = { table, digit }; break; }
      }
      if (!matched) { ok = false; break; }
      leftPatternKey += matched.table;
      leftDigits.push(matched.digit);
      pos += 4;
    }
    if (!ok) continue;

    if (pos + 5 > runs.length) continue;
    const midGroup = runs.slice(pos, pos + 5);
    const midStr = runsToModuleString(midGroup, unit, 5);
    if (midStr !== MIDDLE) continue;
    pos += midGroup.length;

    const rightDigits: number[] = [];
    for (let d = 0; d < 6; d++) {
      if (pos + 4 > runs.length) { ok = false; break; }
      const group = runs.slice(pos, pos + 4);
      const bitStr = runsToModuleString(group, unit, 7);
      if (!bitStr) { ok = false; break; }
      const digit = REVERSE[`C:${bitStr}`];
      if (digit === undefined) { ok = false; break; }
      rightDigits.push(digit);
      pos += 4;
    }
    if (!ok) continue;

    const firstDigit = LEFT_PATTERN.indexOf(leftPatternKey);
    if (firstDigit === -1) continue;

    const value = [firstDigit, ...leftDigits, ...rightDigits].join('');
    if (checksumValid(value)) return value;
  }
  return null;
};

// Binarizes one horizontal row of an ImageData buffer (RGBA, 4 bytes/pixel)
// via a simple min/max midpoint threshold — good enough for the
// high-contrast, clean images this reader targets.
const binarizeRow = (data: Uint8ClampedArray, width: number, y: number): (0 | 1)[] => {
  const lum: number[] = [];
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) * 4;
    lum.push(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  const min = Math.min(...lum);
  const max = Math.max(...lum);
  const threshold = (min + max) / 2;
  return lum.map((v) => (v < threshold ? 1 : 0));
};

// Scans several horizontal lines across the image (skipping the top/bottom
// margins, where a label/whitespace usually sits) and returns the first
// EAN-13 value that decodes with a valid checksum, or null if none found.
export const decodeEan13FromImageData = (imageData: ImageData): string | null => {
  const { data, width, height } = imageData;
  const startY = Math.floor(height * 0.1);
  const endY = Math.floor(height * 0.7);
  for (let y = startY; y < endY; y += 2) {
    const bits = binarizeRow(data, width, y);
    const result = decodeRow(bits);
    if (result) return result;
  }
  return null;
};
