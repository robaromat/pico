import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Produit dist/sw.js à partir de sw/sw.js (repris de Boire & Manger) : liste des fichiers à garder hors connexion
 * et numéro de version = empreinte de cette liste, pour que chaque déploiement installe une nouvelle version.
 */
function serviceWorker(): Plugin {
  return {
    name: 'pico-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html');
      const publicFiles = ['favicon.svg', 'manifest.webmanifest', ...readdirSync('public/icons').map((f) => `icons/${f}`)];
      const precache = ['./', ...built, ...publicFiles].sort();
      const version = createHash('sha256').update(precache.join('|') + pkg.version).digest('hex').slice(0, 10);
      const template = readFileSync('sw/sw.js', 'utf8');
      if (!template.includes('= __VERSION__;') || !template.includes('= __PRECACHE__;')) throw new Error('sw/sw.js : marqueurs introuvables');
      const source = template
        .replace('= __VERSION__;', `= ${JSON.stringify(version)};`)
        .replace('= __PRECACHE__;', `= ${JSON.stringify(precache)};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// L'app est servie par GitHub Pages sous https://robaromat.github.io/pico/
export default defineConfig({
  base: '/pico/',
  plugins: [preact(), serviceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
