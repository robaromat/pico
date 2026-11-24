import { countedValidations, childEvents } from '../../model/rules';
import type { PicoFile } from '../../model/types';

// Ce que la tablette n'a pas encore fêté : validations et bons points surprise arrivés depuis un téléphone.
// La liste des événements déjà fêtés est gardée sur l'appareil (pas dans les données partagées).

const KEY = 'pico-seen';

export interface Celebration {
  kind: 'validate' | 'surprise';
  ids: string[];
  points: number;
  games: number;
  titles: string[];
  text?: string;
}

function readSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-400)));
  } catch {
    /* rien */
  }
}

function candidates(f: PicoFile, childId: string) {
  const evs = childEvents(f, childId);
  return { vals: countedValidations(evs), surprises: evs.filter((e) => e.type === 'surprise') };
}

/** Fêtes en attente. Au tout premier lancement, tout l'historique est considéré comme déjà vu. */
export function pendingCelebrations(f: PicoFile, childId: string): Celebration[] {
  const { vals, surprises } = candidates(f, childId);
  let seen = readSeen();
  if (!seen) {
    seen = new Set([...vals, ...surprises].map((e) => e.id));
    writeSeen(seen);
    return [];
  }
  const out: Celebration[] = [];
  const newVals = vals.filter((v) => !seen.has(v.id));
  if (newVals.length)
    out.push({
      kind: 'validate',
      ids: newVals.map((v) => v.id),
      points: newVals.reduce((n, v) => n + v.points, 0),
      games: newVals.filter((v) => v.game).length,
      titles: newVals.map((v) => f.missions.find((m) => m.id === v.missionId)?.title ?? 'une mission'),
    });
  for (const s of surprises)
    if (!seen.has(s.id) && s.type === 'surprise') out.push({ kind: 'surprise', ids: [s.id], points: s.points, games: 0, titles: [], text: s.text });
  return out;
}

export function markSeen(ids: string[]): void {
  const seen = readSeen() ?? new Set<string>();
  for (const id of ids) seen.add(id);
  writeSeen(seen);
}
