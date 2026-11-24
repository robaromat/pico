import { signal } from '@preact/signals';
import { GitHubError, type RemoteFile } from './github';

// Moteur de synchronisation : l'app travaille toujours sur la copie locale (affichage immédiat, hors connexion),
// et le moteur la rapproche de GitHub en arrière-plan.
//
//   modifier → copie locale + IndexedDB, marquée « en attente » → envoi groupé ~1 s plus tard
//   envoi refusé (409/422) → relire GitHub, fusionner (merge.ts), renvoyer
//   pas de réseau → reste « en attente », renvoyé au retour du réseau (événement online, retour sur l'app…)

export type SyncStatus = 'loading' | 'ok' | 'pending' | 'syncing' | 'offline' | 'error';

export interface EngineDeps<T> {
  read: () => Promise<RemoteFile<T>>;
  write: (data: T, sha: string | null, message: string) => Promise<string>;
  load: () => Promise<PersistedState<T> | undefined>;
  save: (s: PersistedState<T>) => Promise<void>;
  /** Fusion à trois quand les deux appareils ont écrit (voir model/merge.ts). */
  merge: (base: T | null, local: T, remote: T) => T;
  /** Message du commit GitHub. */
  message: (data: T) => string;
  pushDelayMs?: number;
}

export interface PersistedState<T> {
  local: T | null;
  base: RemoteFile<T> | null;
  dirty: boolean;
  lastSyncAt: string | null;
}

const MAX_ATTEMPTS = 5;

export function createSyncEngine<T>(deps: EngineDeps<T>) {
  const data = signal<T | null>(null);
  const status = signal<SyncStatus>('loading');
  const error = signal<string | null>(null);
  const lastSyncAt = signal<string | null>(null);

  let base: RemoteFile<T> | null = null;
  let dirty = false;
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let editsSinceSend = 0;

  const persist = () => deps.save({ local: data.value, base, dirty, lastSyncAt: lastSyncAt.value });

  /** Exécute les opérations réseau une par une, jamais en parallèle. */
  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task, task);
    return queue;
  }

  async function adoptRemote(r: RemoteFile<T>) {
    if (dirty && data.value) data.value = deps.merge(base?.data ?? null, data.value, r.data);
    else data.value = r.data;
    base = r;
  }

  async function pushLoop() {
    for (let attempt = 0; dirty && attempt < MAX_ATTEMPTS; attempt++) {
      if (!base) await adoptRemote(await deps.read());
      const sending = data.value;
      if (!sending || !base) return;
      const editsBefore = editsSinceSend;
      try {
        const sha = await deps.write(sending, base.sha, deps.message(sending));
        base = { data: sending, sha };
        if (editsSinceSend === editsBefore) dirty = false;
      } catch (e) {
        if (e instanceof GitHubError && e.kind === 'conflict') {
          await adoptRemote(await deps.read());
          continue;
        }
        throw e;
      }
    }
  }

  function sync(): Promise<void> {
    clearTimeout(timer);
    return enqueue(async () => {
      if (!data.value) status.value = 'loading';
      else status.value = 'syncing';
      try {
        if (!dirty) await adoptRemote(await deps.read());
        await pushLoop();
        lastSyncAt.value = new Date().toISOString();
        error.value = null;
        status.value = dirty ? 'pending' : 'ok';
      } catch (e) {
        const ge = e instanceof GitHubError ? e : new GitHubError('server', String(e));
        if (ge.kind === 'network') {
          status.value = dirty ? 'offline' : data.value ? 'offline' : 'error';
          error.value = data.value ? null : ge.message;
        } else {
          status.value = 'error';
          error.value = ge.message;
        }
      }
      await persist();
    });
  }

  async function init(): Promise<void> {
    const s = await deps.load();
    if (s) {
      data.value = s.local ?? s.base?.data ?? null;
      base = s.base;
      dirty = s.dirty;
      lastSyncAt.value = s.lastSyncAt;
      if (data.value) status.value = dirty ? 'pending' : 'ok';
    }
    await sync();
  }

  /** Modifie les données. `fn` reçoit l'état courant et renvoie le nouvel état (sans muter l'ancien). */
  function mutate(fn: (d: T) => T): void {
    if (!data.value) return;
    data.value = fn(data.value);
    dirty = true;
    editsSinceSend++;
    if (status.value !== 'error') status.value = 'pending';
    void persist();
    clearTimeout(timer);
    timer = setTimeout(() => void sync(), deps.pushDelayMs ?? 1000);
  }

  return {
    data,
    status,
    error,
    lastSyncAt,
    init,
    sync,
    mutate,
    get hasPendingChanges() {
      return dirty;
    },
  };
}

export type SyncEngine<T> = ReturnType<typeof createSyncEngine<T>>;

/** Ce qu'il faut pour afficher l'état d'une synchro, quel que soit le carnet. */
export type SyncView = Pick<SyncEngine<unknown>, 'status' | 'error' | 'lastSyncAt' | 'sync' | 'hasPendingChanges'>;
