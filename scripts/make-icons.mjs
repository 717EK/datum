// Generate the PWA icon set (PNG + SVG) procedurally — no image libraries
// needed. Design: rounded blue tile with an isometric cube (the same "box"
// motif the viewer's toolbar uses).
//
//   icons/icon-192.png, icon-512.png       purpose "any"  (rounded tile, transparent corners)
//   icons/icon-maskable-512.png            purpose "maskable" (full-bleed, cube in the safe zone)
//   icons/apple-touch-icon.png (180)       iOS home screen (full-bleed; iOS rounds it)
//   icons/favicon-32.png, icon.svg
//
// Usage: node scripts/make-icons.mjs [outDir]   (default: public/icons)

import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import path from "path";

const outDir = process.argv[2] ?? path.resolve("public/icons");
mkdirSync(outDir, { recursive: true });

// --- Palette -----------------------------------------------------------------
const BG_TOP = [37, 99, 235]; // #2563eb
const BG_BOTTOM = [30, 64, 175]; // #1e40af
const TOP = [255, 255, 255];
const LEFT = [191, 219, 254]; // #bfdbfe
const RIGHT = [147, 197, 253]; // #93c5fd
const EDGE = [30, 58, 138]; // #1e3a8a

// --- Cube polygons in unit space (0..1) ------------------------------------
function cubeFaces(scale = 1) {
  const c = [0.5, 0.54];
  const s = (p) => [c[0] + (p[0] - c[0]) * scale, c[1] + (p[1] - c[1]) * scale];
  const top = [[0.5, 0.2], [0.79, 0.37], [0.5, 0.54], [0.21, 0.37]].map(s);
  const left = [[0.21, 0.37], [0.5, 0.54], [0.5, 0.88], [0.21, 0.71]].map(s);
  const right = [[0.5, 0.54], [0.79, 0.37], [0.79, 0.71], [0.5, 0.88]].map(s);
  return { top, left, right };
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distToPolyEdges(x, y, poly) {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    d = Math.min(d, distToSegment(x, y, a[0], a[1], b[0], b[1]));
  }
  return d;
}

function inRoundedRect(x, y, r) {
  // unit square with corner radius r
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/** Sample the design at unit coords; returns [r,g,b,a]. */
function sample(x, y, { rounded, cubeScale, edgeWidth }) {
  if (rounded && !inRoundedRect(x, y, 0.22)) return [0, 0, 0, 0];
  const t = y;
  const bg = BG_TOP.map((c, i) => c + (BG_BOTTOM[i] - c) * t);
  const faces = cubeFaces(cubeScale);
  let col = bg;
  if (pointInPoly(x, y, faces.top)) col = TOP;
  else if (pointInPoly(x, y, faces.left)) col = LEFT;
  else if (pointInPoly(x, y, faces.right)) col = RIGHT;
  // Thin edge lines between faces
  const d = Math.min(
    distToPolyEdges(x, y, faces.top),
    distToPolyEdges(x, y, faces.left),
    distToPolyEdges(x, y, faces.right),
  );
  if (d < edgeWidth) col = EDGE;
  return [col[0], col[1], col[2], 255];
}

function render(size, opts) {
  const SS = 4; // supersampling
  const px = new Uint8Array(size * size * 4);
  const edgeWidth = 0.014 * (opts.cubeScale ?? 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = sample(u, v, { ...opts, edgeWidth });
          // premultiplied accumulate
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      if (a > 0) {
        px[o] = Math.round(r / a);
        px[o + 1] = Math.round(g / a);
        px[o + 2] = Math.round(b / a);
        px[o + 3] = Math.round(a / n);
      }
    }
  }
  return px;
}

// --- Minimal PNG encoder -------------------------------------------------------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, size, opts) {
  const png = encodePng(size, render(size, opts));
  writeFileSync(path.join(outDir, name), png);
  console.log(`[icons] ${name} (${size}px, ${png.length} bytes)`);
}

write("icon-192.png", 192, { rounded: true, cubeScale: 1 });
write("icon-512.png", 512, { rounded: true, cubeScale: 1 });
write("icon-maskable-512.png", 512, { rounded: false, cubeScale: 0.78 });
write("apple-touch-icon.png", 180, { rounded: false, cubeScale: 0.9 });
write("favicon-32.png", 32, { rounded: true, cubeScale: 1.05 });

// SVG twin (crisp at any size; also used as the tab icon on desktop browsers).
const f = cubeFaces(1);
const pts = (p) => p.map(([x, y]) => `${(x * 100).toFixed(1)},${(y * 100).toFixed(1)}`).join(" ");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#g)"/>
<g stroke="#1e3a8a" stroke-width="2.4" stroke-linejoin="round">
<polygon points="${pts(f.top)}" fill="#ffffff"/>
<polygon points="${pts(f.left)}" fill="#bfdbfe"/>
<polygon points="${pts(f.right)}" fill="#93c5fd"/>
</g>
</svg>
`;
writeFileSync(path.join(outDir, "icon.svg"), svg);
console.log("[icons] icon.svg");
