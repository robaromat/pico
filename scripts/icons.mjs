// Génère les icônes de l'app (PNG) : Pico sur fond ciel.
// Usage : npm run icons   (les PNG sont versionnés dans public/icons, à relancer seulement si le dessin change)
// Le dessin est relu depuis src/pico.ts (chargé par Vite).
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { picoArt } = await vite.ssrLoadModule('/src/pico.ts');
await vite.close();

const BG = '#DDF1FF';
const art = picoArt('happy');

/** rounded : coins arrondis (icône « any ») ; scale : réduction du dessin (zone de sécurité des icônes « maskable »). */
const svg = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" ${rounded ? 'rx="26"' : ''} fill="${BG}"/>
  <g transform="translate(60 60) scale(${scale}) translate(-64 -70)">${art}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, { rounded: true, scale: 0.95 }],
  ['icon-512.png', 512, { rounded: true, scale: 0.95 }],
  ['maskable-512.png', 512, { rounded: false, scale: 0.7 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.85 }],
];
for (const [name, size, opts] of out) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
  console.log('✓', name);
}
writeFileSync('public/favicon.svg', svg({ rounded: true, scale: 0.95 }).replace(/\n\s*/g, ''));
console.log('✓ favicon.svg');
