/**
 * Generates the app icons.
 *
 * Written by hand rather than pulled from an image library, for the same reason
 * the engine has no dependencies: this needs to draw four rectangles, and Node
 * already ships the one hard part, zlib. A dependency here would be a hundred
 * thousand lines to avoid writing forty.
 *
 * The mark is a page with three lines on it, in the accent colour. It reads at
 * 48 pixels on a home screen, which is the only size that actually matters.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const ACCENT = [122, 75, 214];
const PAPER = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Builds an RGBA PNG from a pixel function. */
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let at = 0;
  for (let y = 0; y < size; y += 1) {
    raw[at] = 0; // no per-row filter
    at += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size);
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      raw[at + 3] = a;
      at += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * The mark. `inset` is the fraction of the canvas kept clear at the edges.
 *
 * A maskable icon is cropped to a circle by some launchers, so its artwork sits
 * inside the safe zone, which is the middle 80 percent. The normal icon uses
 * the full canvas.
 */
function mark(inset) {
  return (x, y, size) => {
    const pad = size * inset;
    const w = size - pad * 2;

    // Page
    const px = pad + w * 0.18;
    const py = pad + w * 0.08;
    const pw = w * 0.64;
    const ph = w * 0.84;
    const onPage = x >= px && x < px + pw && y >= py && y < py + ph;
    if (!onPage) return [...ACCENT, inset > 0 ? 255 : 0];

    // Three lines of text on the page
    for (let i = 0; i < 3; i += 1) {
      const ly = py + ph * (0.24 + i * 0.22);
      const lh = ph * 0.09;
      const lw = pw * (i === 2 ? 0.42 : 0.62);
      if (y >= ly && y < ly + lh && x >= px + pw * 0.19 && x < px + pw * 0.19 + lw) {
        return [...ACCENT, 255];
      }
    }
    return [...PAPER, 255];
  };
}

mkdirSync("app/public", { recursive: true });

// Background is opaque accent for maskable, transparent for the plain icon.
const solid = (fn) => (x, y, size) => {
  const [r, g, b, a] = fn(x, y, size);
  return a === 0 ? [...ACCENT, 255] : [r, g, b, a];
};

writeFileSync("app/public/icon-192.png", png(192, solid(mark(0.06))));
writeFileSync("app/public/icon-512.png", png(512, solid(mark(0.06))));
writeFileSync("app/public/icon-maskable-512.png", png(512, solid(mark(0.14))));

console.log("Wrote 3 icons to app/public/");
