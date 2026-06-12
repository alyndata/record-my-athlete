// Generates the app icon, Android adaptive icon, splash, and favicon PNGs
// from inline SVG. Run with:
//
//   npm install --no-save sharp
//   node scripts/generate-assets.mjs
//
// The generated PNGs in /assets are committed; this script just reproduces them.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');
mkdirSync(ASSETS, { recursive: true });

const NAVY = '#0B1220';
const ORANGE = '#FF6B35';
const SEAM = '#0B1220';

/** A basketball centred at (cx,cy) with radius r and seam stroke width sw. */
function basketball(cx, cy, r, sw) {
  const k = 0.9; // how far the curved seams bulge
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${ORANGE}" />
      <g stroke="${SEAM}" stroke-width="${sw}" fill="none" stroke-linecap="round">
        <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" />
        <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" />
        <path d="M ${cx} ${cy - r} C ${cx - r * k} ${cy - r * 0.45} ${cx - r * k} ${cy + r * 0.45} ${cx} ${cy + r}" />
        <path d="M ${cx} ${cy - r} C ${cx + r * k} ${cy - r * 0.45} ${cx + r * k} ${cy + r * 0.45} ${cx} ${cy + r}" />
      </g>
    </g>`;
}

function iconSvg(size, { background = true } = {}) {
  const c = size / 2;
  const r = size * 0.32;
  const sw = Math.round(size * 0.022);
  const bg = background ? `<rect width="${size}" height="${size}" fill="${NAVY}" />` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg}
    ${basketball(c, c, r, sw)}
  </svg>`;
}

async function render(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(ASSETS, file));
  console.log('wrote', file);
}

await render(iconSvg(1024), 'icon.png', 1024);
await render(iconSvg(1024, { background: false }), 'adaptive-icon.png', 1024);
await render(iconSvg(1024), 'splash-icon.png', 1024);
await render(iconSvg(48), 'favicon.png', 48);

console.log('Done.');
