import { newId } from '../lib/ids';
import { childEvents, decisions } from './rules';
import { dayKey } from './time';
import type { Child, GameId, Mission, PicoEvent, PicoFile, Reward, Settings } from './types';

// Modifications du fichier. Chaque fonction renvoie un nouveau fichier (l'ancien n'est jamais modifié),
// pour le moteur de synchro (mutate) et pour les tests.

type NewEvent = PicoEvent extends infer E ? (E extends PicoEvent ? Omit<E, 'id' | 'at' | 'day' | 'childId'> : never) : never;

export function addEvent(f: PicoFile, childId: string, ev: NewEvent, now: Date = new Date()): PicoFile {
  const full = { ...ev, id: newId('e'), childId, at: now.toISOString(), day: dayKey(now) } as PicoEvent;
  return { ...f, events: [...f.events, full] };
}

export const declare = (f: PicoFile, childId: string, missionId: string, now?: Date) => addEvent(f, childId, { type: 'declare', missionId }, now);

/** Valide (ou refuse) une déclaration. La partie n'est donnée que si la validation tombe le jour de la déclaration. */
export function decide(f: PicoFile, declareId: string, ok: boolean, now: Date = new Date()): PicoFile {
  const d = f.events.find((e) => e.id === declareId);
  if (!d || d.type !== 'declare') return f;
  if (decisions(childEvents(f, d.childId)).has(declareId)) return f;
  if (!ok) return addEvent(f, d.childId, { type: 'refuse', declareId }, now);
  const m = f.missions.find((x) => x.id === d.missionId);
  const game = !!m?.givesGame && d.day === dayKey(now);
  return addEvent(f, d.childId, { type: 'validate', declareId, missionId: d.missionId, points: m?.points ?? 1, game }, now);
}

export function decideAll(f: PicoFile, declareIds: string[], now?: Date): PicoFile {
  return declareIds.reduce((acc, id) => decide(acc, id, true, now), f);
}

export function updateChild(f: PicoFile, childId: string, patch: Partial<Omit<Child, 'id'>>, now = new Date()): PicoFile {
  return { ...f, children: f.children.map((c) => (c.id === childId ? { ...c, ...patch, updatedAt: now.toISOString() } : c)) };
}

export function updateSettings(f: PicoFile, patch: Partial<Settings>, now = new Date()): PicoFile {
  return { ...f, settings: { ...f.settings, ...patch, updatedAt: now.toISOString() } };
}

export function upsertMission(f: PicoFile, m: Mission, now = new Date()): PicoFile {
  const next = { ...m, updatedAt: now.toISOString() };
  const exists = f.missions.some((x) => x.id === m.id);
  return { ...f, missions: exists ? f.missions.map((x) => (x.id === m.id ? next : x)) : [...f.missions, next] };
}

export function upsertReward(f: PicoFile, r: Reward, now = new Date()): PicoFile {
  const next = { ...r, updatedAt: now.toISOString() };
  const exists = f.rewards.some((x) => x.id === r.id);
  return { ...f, rewards: exists ? f.rewards.map((x) => (x.id === r.id ? next : x)) : [...f.rewards, next] };
}

/** Début d'une partie : la partie est consommée tout de suite (fermer l'appli ne la rend pas). */
export const startPlay = (f: PicoFile, childId: string, gameId: GameId = 'course', now = new Date()) => addEvent(f, childId, { type: 'play', gameId, score: 0 }, now);

/** Meilleur score d'un jeu (la course reprend l'ancien champ). */
export const bestOf = (c: Child, gameId: GameId) => Math.max(c.bests?.[gameId] ?? 0, gameId === 'course' ? c.best : 0);

/** Fin d'une partie : meilleur score, et difficulté ajustée doucement. */
export function finishPlay(f: PicoFile, childId: string, gameId: GameId, score: number, livesLeft: number, seconds: number, now = new Date()): PicoFile {
  const c = f.children.find((x) => x.id === childId);
  if (!c) return f;
  let level = c.level;
  if (livesLeft <= 0 && seconds < 25) level = Math.max(0.75, level - 0.1);
  else if (livesLeft >= 2) level = Math.min(1.3, level + 0.05);
  const best = Math.max(bestOf(c, gameId), score);
  return updateChild(
    f,
    childId,
    { level: Math.round(level * 100) / 100, bests: { ...c.bests, [gameId]: best }, ...(gameId === 'course' ? { best } : {}) },
    now,
  );
}
