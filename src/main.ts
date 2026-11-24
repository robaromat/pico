// Phase 0 : page de diagnostic. Elle vérifie que l'app tourne bien sur la tablette
// (installée, dans le mode enfant) : stockage local qui survit au redémarrage, accès au réseau,
// hors connexion, son, plein écran paysage pour le jeu.
import './style.css';
import { pico } from './pico';

declare const __APP_VERSION__: string;

/** Présent seulement dans l'appli Android (WebView) : voir android/…/MainActivity.java. */
interface PicoBridge {
  version(): string;
  setLandscape(on: boolean): void;
}
const bridge = (window as unknown as { PicoAndroid?: PicoBridge }).PicoAndroid;

type Status = 'ok' | 'ko' | 'warn' | 'wait';
interface Check {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

const checks = new Map<string, Check>();
const order = ['install', 'storage', 'persist', 'network', 'offline', 'screen'];
const labels: Record<string, string> = {
  install: 'Installée comme une app',
  storage: 'Mémoire de la tablette',
  persist: 'Mémoire protégée',
  network: 'Accès à Internet (GitHub)',
  offline: 'Marche sans réseau',
  screen: 'Écran',
};
for (const id of order) checks.set(id, { id, label: labels[id] ?? id, status: 'wait', detail: 'Vérification…' });

const icon: Record<Status, string> = { ok: '✅', ko: '❌', warn: '⚠️', wait: '⏳' };

function set(id: string, status: Status, detail: string): void {
  const c = checks.get(id);
  if (!c) return;
  c.status = status;
  c.detail = detail;
  render();
}

const app = document.querySelector<HTMLDivElement>('#app')!;
let extra = '';

function render(): void {
  const list = [...checks.values()];
  const bad = list.filter((c) => c.status === 'ko').length;
  const pending = list.filter((c) => c.status === 'wait').length;
  const mood = pending ? 'wait' : bad ? 'wait' : 'happy';
  const title = pending ? 'Je vérifie…' : bad ? `${bad} point${bad > 1 ? 's' : ''} à regarder` : 'Tout marche !';
  app.innerHTML = `
  <main class="wrap">
    <header class="hero">
      ${pico(mood, '#FFC22E', 'hero-pico')}
      <div>
        <h1>${title}</h1>
        <p class="sub">Test de la tablette · version ${__APP_VERSION__}</p>
      </div>
    </header>
    <ul class="checks">
      ${list
        .map(
          (c) => `<li class="check ${c.status}"><span class="ic">${icon[c.status]}</span>
          <div><b>${c.label}</b><span>${c.detail}</span></div></li>`,
        )
        .join('')}
    </ul>
    <section class="tries">
      <h2>À essayer à la main</h2>
      <div class="btns">
        <button id="sound" class="btn sun">🔔 Jouer un son</button>
        <button id="land" class="btn blue">↔️ Plein écran paysage</button>
        <button id="recheck" class="btn leaf">🔄 Revérifier</button>
      </div>
      ${extra ? `<p class="extra">${extra}</p>` : ''}
    </section>
    <section class="howto">
      <h2>Le test du redémarrage</h2>
      <ol>
        <li>Note le nombre d'ouvertures affiché plus haut.</li>
        <li>Ferme l'app, redémarre la tablette, rouvre Pico depuis le mode enfant.</li>
        <li>Le nombre doit avoir augmenté de 1 et la date de première ouverture ne doit pas avoir changé.</li>
        <li>Puis coupe le Wi-Fi et rouvre : la page doit s'afficher quand même.</li>
      </ol>
    </section>
  </main>`;
  document.getElementById('sound')?.addEventListener('click', playChime);
  document.getElementById('land')?.addEventListener('click', tryLandscape);
  document.getElementById('recheck')?.addEventListener('click', () => void runAll());
}

// ---------- Mémoire (IndexedDB) ----------
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pico', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction('kv', mode).objectStore('kv'));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

interface Visits {
  first: string;
  opens: number;
}
let counted = false;

async function checkStorage(): Promise<void> {
  try {
    const db = await idb();
    const prev = await tx<Visits | undefined>(db, 'readonly', (s) => s.get('visits'));
    let v = prev ?? { first: new Date().toISOString(), opens: 0 };
    if (!counted) {
      v = { ...v, opens: v.opens + 1 };
      await tx(db, 'readwrite', (s) => s.put(v, 'visits'));
      counted = true;
    }
    const again = await tx<Visits | undefined>(db, 'readonly', (s) => s.get('visits'));
    db.close();
    if (!again || again.opens !== v.opens) throw new Error('relecture différente');
    const first = new Date(again.first).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    set('storage', 'ok', `${again.opens} ouverture${again.opens > 1 ? 's' : ''} · première le ${first}`);
  } catch (e) {
    set('storage', 'ko', `Impossible d'écrire : ${(e as Error).message}`);
  }
}

async function checkPersist(): Promise<void> {
  if (bridge) return set('persist', 'ok', "Les données sont rangées dans l'appli, Chrome ne peut pas les effacer");
  if (!navigator.storage?.persist) return set('persist', 'warn', 'Non disponible sur ce navigateur');
  try {
    const granted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
    const est = await navigator.storage.estimate();
    const mo = ((est.quota ?? 0) / 1024 / 1024).toFixed(0);
    set(
      'persist',
      granted ? 'ok' : 'warn',
      granted ? `Android ne l'effacera pas tout seul · ${mo} Mo disponibles` : `Pas encore protégée (souvent normal avant l'installation) · ${mo} Mo disponibles`,
    );
  } catch (e) {
    set('persist', 'warn', (e as Error).message);
  }
}

// ---------- Réseau ----------
async function checkNetwork(): Promise<void> {
  if (!navigator.onLine) return set('network', 'warn', 'La tablette dit être hors ligne');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const t0 = performance.now();
    const res = await fetch('https://api.github.com/repos/robaromat/pico', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    const ms = Math.round(performance.now() - t0);
    // Toute réponse de GitHub (même 404) prouve que la tablette a accès à Internet.
    if (res.status < 500 && res.status !== 403) set('network', 'ok', `GitHub répond en ${ms} ms`);
    else if (res.status === 403) set('network', 'warn', `GitHub répond mais limite les appels (${res.status}) : réessaie dans 1 h`);
    else set('network', 'ko', `GitHub répond avec une erreur ${res.status}`);
  } catch (e) {
    set('network', 'ko', `Pas de réponse de GitHub (${(e as Error).name === 'AbortError' ? 'délai dépassé' : 'bloqué'})`);
  }
}

// ---------- Installation et hors connexion ----------
let swError = '';
function checkInstall(): void {
  if (bridge) return set('install', 'ok', `Dans l'appli Android Pico (v${bridge.version()})`);
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  set('install', standalone ? 'ok' : 'warn', standalone ? 'Ouverte en plein écran, sans barre du navigateur' : 'Ouverte dans le navigateur : installe-la depuis le menu de Chrome');
}

async function checkOffline(): Promise<void> {
  if (!('serviceWorker' in navigator)) return set('offline', 'ko', 'Service worker non pris en charge');
  if (import.meta.env.DEV) return set('offline', 'warn', 'Désactivé en développement');
  const reg = await navigator.serviceWorker.getRegistration();
  if (swError) set('offline', 'ko', `Le service worker n'a pas pu s'installer (${swError})`);
  else if (navigator.serviceWorker.controller) set('offline', 'ok', "L'app est gardée en mémoire");
  else if (reg) set('offline', 'warn', 'Mise en mémoire en cours : rouvre l\'app une fois');
  else set('offline', 'wait', 'Installation du service worker…');
}

function checkScreen(): void {
  const o = screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait');
  const touch = navigator.maxTouchPoints > 0 ? 'tactile' : 'non tactile';
  set('screen', 'ok', `${innerWidth} × ${innerHeight} · ${o.startsWith('landscape') ? 'paysage' : 'portrait'} · ${touch}`);
}

// ---------- Essais manuels ----------
let audio: AudioContext | null = null;
function playChime(): void {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    [659, 784, 1047].forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.4);
      o.connect(g).connect(audio!.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.45);
    });
    extra = '🔔 Tu dois avoir entendu trois petites notes. Sinon, monte le volume de la tablette.';
  } catch (e) {
    extra = `❌ Son impossible : ${(e as Error).message}`;
  }
  render();
}

async function tryLandscape(): Promise<void> {
  if (bridge) {
    bridge.setLandscape(true);
    extra = '↔️ La tablette doit être passée en paysage plein écran. Touche « Revérifier » pour revenir.';
    return render();
  }
  const steps: string[] = [];
  try {
    await document.documentElement.requestFullscreen();
    steps.push('plein écran ✅');
  } catch (e) {
    steps.push(`plein écran ❌ (${(e as Error).name})`);
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (!o?.lock) throw new Error('non pris en charge');
    await o.lock('landscape');
    steps.push('paysage ✅');
  } catch (e) {
    steps.push(`paysage ❌ (${(e as Error).message || (e as Error).name})`);
  }
  extra = `↔️ ${steps.join(' · ')}. Touche « Revérifier » pour revenir.`;
  render();
}

async function leaveLandscape(): Promise<void> {
  bridge?.setLandscape(false);
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* rien à défaire */
  }
}

async function runAll(): Promise<void> {
  await leaveLandscape();
  extra = '';
  for (const c of checks.values()) Object.assign(c, { status: 'wait', detail: 'Vérification…' });
  render();
  checkInstall();
  checkScreen();
  await Promise.all([checkStorage(), checkPersist(), checkNetwork(), checkOffline()]);
}

addEventListener('resize', checkScreen);
addEventListener('online', () => void checkNetwork());
addEventListener('offline', () => void checkNetwork());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').then(
    () => navigator.serviceWorker.ready.then(() => void checkOffline()),
    (e: Error) => {
      swError = e.message.includes('unknown error') ? 'erreur inconnue' : e.name;
      void checkOffline();
    },
  );
}

render();
void runAll();
