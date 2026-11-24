import { computed, signal } from '@preact/signals';
import { device, repoRef } from '../device';
import { pendingDeclarations } from '../model/rules';
import type { PicoFile } from '../model/types';
import { mergePico } from '../model/merge';
import { parsePicoFile } from '../model/validate';
import { createSyncEngine, type PersistedState, type SyncEngine } from './engine';
import { PICO_FILE, readJsonFile, writeJsonFile } from './github';
import { idbClear, idbGet, idbSet } from './idb';

// L'instance de synchro de l'app (un seul fichier, pico.json), branchée sur l'appareil et IndexedDB.
// Synchro seulement quand l'app est ouverte : à l'ouverture et au retour sur l'app, après chaque action,
// puis toutes les 15 s si une mission attend une réponse, sinon toutes les 2 min.

export const engine = signal<SyncEngine<PicoFile> | null>(null);
export const data = computed(() => engine.value?.data.value ?? null);

export function startSync(): Promise<void> {
  const d = device.value;
  if (!d) return Promise.resolve();
  const key = `sync:${d.owner}/${d.repo}/${PICO_FILE}`;
  const e = createSyncEngine<PicoFile>({
    read: () => readJsonFile(repoRef(), PICO_FILE, parsePicoFile),
    write: (f, sha, msg) => writeJsonFile(repoRef(), PICO_FILE, f, sha || null, msg),
    load: async () => {
      const st = await idbGet<PersistedState<PicoFile>>(key);
      if (!st) return st;
      const again = (f: PicoFile) => parsePicoFile(f) ?? f;
      return { ...st, local: st.local && again(st.local), base: st.base && { ...st.base, data: again(st.base.data) } };
    },
    save: (st) => idbSet(key, st),
    merge: mergePico,
    message: () => `Pico depuis ${d.role === 'child' ? 'la tablette' : 'un téléphone'}`,
    pushDelayMs: 600,
  });
  engine.value = e;
  return e.init();
}

export function mutate(fn: (f: PicoFile) => PicoFile): void {
  engine.value?.mutate(fn);
}

export async function resetLocal(): Promise<void> {
  engine.value = null;
  await idbClear();
}

let installed = false;
let lastFocus = 0;
let lastTick = 0;

function waiting(): boolean {
  const f = data.value;
  return !!f && f.children.some((c) => pendingDeclarations(f, c.id).length > 0);
}

export function installSyncTriggers(): void {
  if (installed) return;
  installed = true;
  const sync = () => void engine.value?.sync();
  window.addEventListener('online', sync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastFocus < 5_000) return;
    lastFocus = Date.now();
    sync();
  });
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    const every = waiting() || engine.value?.hasPendingChanges ? 15_000 : 120_000;
    if (Date.now() - lastTick < every) return;
    lastTick = Date.now();
    sync();
  }, 5_000);
}
