/**
 * Generates the app icons as real PNGs, no dependencies.
 *
 *   node tools/make-icons.js
 *
 * Draws a disc on a solid background with 3x3 supersampling for smooth edges,
 * then writes a minimal RGBA PNG (IHDR/IDAT/IEND) using node's zlib.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const BG = [18, 105, 65];      // --accent
const DISC = [240, 246, 242];
const OUT_DIR = path.join(import.meta.dirname, '..', 'icons');

/* ------------------------------------------------------------- PNG writing */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;   // bit depth
  header[9] = 6;   // colour type: RGBA
  // 10..12 = compression / filter / interlace, all 0

  // Each scanline is prefixed with filter type 0 (none).
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------------------------------------------------------- drawing */

/**
 * A disc seen at a slight angle: an ellipse with a concentric rim ring.
 * `inset` shrinks the artwork for maskable icons, which get cropped to a circle.
 */
function drawDisc(size, inset) {
  const pixels = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const scale = (1 - inset) / 2;
  const rx = size * scale * 0.78;
  const ry = size * scale * 0.60;
  const ringOuter = 0.70;
  const ringInner = 0.52;
  const SS = 3; // supersampling factor

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let disc = 0;
      let ring = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS - c;
          const py = y + (sy + 0.5) / SS - c;
          const d = Math.hypot(px / rx, py / ry); // 1.0 == disc edge
          if (d <= 1) disc += 1;
          if (d <= ringOuter && d >= ringInner) ring += 1;
        }
      }
      const samples = SS * SS;
      const discA = disc / samples;
      const ringA = ring / samples;

      // Background, then the disc, then the rim ring punched back to bg colour.
      const rgb = [0, 1, 2].map((i) => {
        const withDisc = BG[i] + (DISC[i] - BG[i]) * discA;
        return Math.round(withDisc + (BG[i] - withDisc) * ringA);
      });

      const o = (y * size + x) * 4;
      pixels[o] = rgb[0];
      pixels[o + 1] = rgb[1];
      pixels[o + 2] = rgb[2];
      pixels[o + 3] = 255; // opaque — iOS home-screen icons must not be transparent
    }
  }
  return pixels;
}

/* ------------------------------------------------------------------- main */

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', 192, 0.16],
  ['icon-512.png', 512, 0.16],
  ['icon-maskable-512.png', 512, 0.34], // extra padding for the safe zone
  ['apple-touch-icon.png', 180, 0.16],
];

for (const [name, size, inset] of targets) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, encodePng(size, drawDisc(size, inset)));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${size}x${size})`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="rgb(${BG.join(',')})"/>
  <ellipse cx="256" cy="256" rx="168" ry="129" fill="rgb(${DISC.join(',')})"/>
  <ellipse cx="256" cy="256" rx="118" ry="90" fill="rgb(${BG.join(',')})"/>
  <ellipse cx="256" cy="256" rx="87" ry="67" fill="rgb(${DISC.join(',')})"/>
</svg>
`;
fs.writeFileSync(path.join(OUT_DIR, 'icon.svg'), svg);
console.log('wrote icons/icon.svg');
