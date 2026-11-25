import { addDays, dayKey, minutesOf, periodAt, toMinutes, type Period } from './time';
import type { Child, Mission, PicoEvent, PicoFile } from './types';

// Règles de calcul : tout est déduit du fichier (journal d'événements + réglages), rien n'est stocké.
//   points  = solde de départ + validations + bons points surprise + corrections − achats
//   parties = validations du jour qui donnent une partie − parties jouées du jour (remis à zéro à minuit)
// Deux téléphones peuvent valider la même mission en même temps : seule la première décision
// (validation ou « pas encore ») sur une déclaration compte.

export const MAX_VISIBLE = 5;

type Ev<T extends PicoEvent['type']> = Extract<PicoEvent, { type: T }>;

const byTime = (a: PicoEvent, b: PicoEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1);

export function childEvents(f: PicoFile, childId: string): PicoEvent[] {
  return f.events.filter((e) => e.childId === childId).sort(byTime);
}

const ofType = <T extends PicoEvent['type']>(evs: PicoEvent[], t: T) => evs.filter((e): e is Ev<T> => e.type === t);

/** Première décision prise sur chaque déclaration. */
export function decisions(evs: PicoEvent[]): Map<string, Ev<'validate'> | Ev<'refuse'>> {
  const out = new Map<string, Ev<'validate'> | Ev<'refuse'>>();
  for (const e of evs) {
    if ((e.type === 'validate' || e.type === 'refuse') && !out.has(e.declareId)) out.set(e.declareId, e);
  }
  return out;
}

/** Validations qui comptent (une seule par déclaration). */
export function countedValidations(evs: PicoEvent[]): Ev<'validate'>[] {
  return [...decisions(evs).values()].filter((d): d is Ev<'validate'> => d.type === 'validate');
}

export function balance(f: PicoFile, child: Child): number {
  const evs = childEvents(f, child.id);
  let n = child.startPoints;
  for (const v of countedValidations(evs)) n += v.points;
  for (const e of evs) {
    if (e.type === 'surprise') n += e.points;
    else if (e.type === 'correct') n += e.delta;
    else if (e.type === 'purchase') n -= e.price;
  }
  return n;
}

/** Total des bons points GAGNÉS (missions validées + surprises), sans le solde de départ, les achats ni les corrections. */
export function earnedPoints(f: PicoFile, childId: string): number {
  const evs = childEvents(f, childId);
  let n = 0;
  for (const v of countedValidations(evs)) n += v.points;
  for (const e of evs) if (e.type === 'surprise') n += e.points;
  return n;
}

export function gamesLeft(f: PicoFile, childId: string, today: string): number {
  const evs = childEvents(f, childId);
  const won = countedValidations(evs).filter((v) => v.day === today && v.game).length;
  const played = ofType(evs, 'play').filter((p) => p.day === today).length;
  return Math.max(0, won - played);
}

/** Points gagnés un jour donné (validations + surprises, sans les corrections). */
export function pointsOn(f: PicoFile, childId: string, day: string): number {
  const evs = childEvents(f, childId);
  let n = 0;
  for (const v of countedValidations(evs)) if (v.day === day) n += v.points;
  for (const e of evs) if (e.type === 'surprise' && e.day === day) n += e.points;
  return n;
}

/** Dernier état d'un interrupteur du jour (journée pause, soirée spéciale). */
function lastOfDay<T extends 'pause' | 'special'>(evs: PicoEvent[], t: T, day: string): Ev<T> | undefined {
  return ofType(evs, t)
    .filter((e) => (e as PicoEvent).day === day)
    .at(-1);
}

export function isPause(f: PicoFile, childId: string, day: string): boolean {
  return lastOfDay(childEvents(f, childId), 'pause', day)?.on ?? false;
}

/** Soirée spéciale en cours : l'heure de fin choisie, sinon null. */
export function specialUntil(f: PicoFile, childId: string, now: Date): string | null {
  const s = lastOfDay(childEvents(f, childId), 'special', dayKey(now));
  if (!s?.on) return null;
  const t = minutesOf(now);
  if (t < toMinutes(f.settings.wakeup) || t >= toMinutes(s.until)) return null;
  return s.until;
}

export function specialPlanned(f: PicoFile, childId: string, day: string): Ev<'special'> | null {
  const s = lastOfDay(childEvents(f, childId), 'special', day);
  return s?.on ? s : null;
}

/** Missions prévues ce jour-là (récurrentes du jour de la semaine + défis du jour), défis en premier. */
export function missionsOfDay(f: PicoFile, childId: string, date: Date): Mission[] {
  const day = dayKey(date);
  const wd = date.getDay();
  const live = f.missions.filter((m) => m.childId === childId && m.active && !m.deleted);
  const oneOffs = live.filter((m) => m.oneOff && m.date === day);
  const recurring = live.filter((m) => !m.oneOff && m.days.includes(wd));
  return [...oneOffs, ...recurring];
}

export type MissionStatus = 'todo' | 'pending' | 'done';

export interface MissionView {
  mission: Mission;
  status: MissionStatus;
  /** Déclaration en attente (pour la valider). */
  declareId?: string;
}

export function missionStatuses(f: PicoFile, childId: string, date: Date): MissionView[] {
  const day = dayKey(date);
  const evs = childEvents(f, childId);
  const dec = decisions(evs);
  const declares = ofType(evs, 'declare').filter((d) => d.day === day);
  // Une mission validée aujourd'hui (même déclarée un autre jour) est faite.
  const validatedToday = new Set(countedValidations(evs).filter((v) => v.day === day).map((v) => v.missionId));
  return missionsOfDay(f, childId, date).map((mission) => {
    const mine = declares.filter((d) => d.missionId === mission.id);
    if (validatedToday.has(mission.id) || mine.some((d) => dec.get(d.id)?.type === 'validate')) return { mission, status: 'done' };
    const last = mine.at(-1);
    if (last && !dec.has(last.id)) return { mission, status: 'pending', declareId: last.id };
    return { mission, status: 'todo' };
  });
}

export interface NowState {
  today: string;
  /** Moment selon les horaires. */
  period: Period;
  /** Pico dort (nuit sans soirée spéciale). */
  night: boolean;
  special: string | null;
  pause: boolean;
  /** Missions affichées sur la tablette maintenant (5 au maximum). */
  visible: MissionView[];
  balance: number;
  games: number;
}

export function nowState(f: PicoFile, child: Child, now: Date): NowState {
  const today = dayKey(now);
  const period = periodAt(f.settings, now);
  const special = specialUntil(f, child.id, now);
  const night = period === 'nuit' && !special;
  const pause = isPause(f, child.id, today);
  // Pendant une soirée spéciale après l'heure du coucher, on reste sur les missions du soir.
  const current = period === 'nuit' ? 'soir' : period;
  const visible =
    night || pause
      ? []
      : missionStatuses(f, child.id, now)
          .filter((v) => v.mission.moment === current || v.mission.moment === 'jour')
          // Mission « à partir de 16 h » : cachée avant l'heure (sauf si déjà déclarée).
          .filter((v) => !v.mission.from || v.status !== 'todo' || minutesOf(now) >= toMinutes(v.mission.from))
          .slice(0, MAX_VISIBLE);
  return { today, period, night, special, pause, visible, balance: balance(f, child), games: gamesLeft(f, child.id, today) };
}

export interface PendingView {
  declare: Ev<'declare'>;
  mission: Mission | undefined;
}

/** Déclarations « J'ai fini ! » encore sans réponse, les plus anciennes d'abord. */
export function pendingDeclarations(f: PicoFile, childId: string): PendingView[] {
  const evs = childEvents(f, childId);
  const dec = decisions(evs);
  const done = new Set(countedValidations(evs).map((v) => `${v.missionId}|${v.day}`));
  return ofType(evs, 'declare')
    .filter((d) => !dec.has(d.id) && !done.has(`${d.missionId}|${d.day}`))
    .map((declare) => ({ declare, mission: f.missions.find((m) => m.id === declare.missionId) }));
}

/** Achats (« Mes trésors »), les plus récents d'abord. */
export function treasures(f: PicoFile, childId: string): Ev<'purchase'>[] {
  return ofType(childEvents(f, childId), 'purchase').reverse();
}

export interface DayStat {
  key: string;
  points: number;
  planned: number;
  validated: number;
}

/** Bilan des 7 derniers jours (aujourd'hui compris), du plus ancien au plus récent. */
export function lastDays(f: PicoFile, childId: string, now: Date, n = 7): DayStat[] {
  const evs = childEvents(f, childId);
  const vals = countedValidations(evs);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(now, i - n + 1);
    const key = dayKey(date);
    const paused = isPause(f, childId, key);
    const planned = paused ? 0 : missionsOfDay(f, childId, date).length;
    const validated = paused ? 0 : new Set(vals.filter((v) => v.day === key).map((v) => v.missionId)).size;
    return { key, points: pointsOn(f, childId, key), planned, validated: Math.min(validated, planned || validated) };
  });
}

export interface MissionRate {
  mission: Mission;
  planned: number;
  validated: number;
}

/** Réussite mission par mission sur les 7 derniers jours (missions récurrentes seulement). */
export function missionRates(f: PicoFile, childId: string, now: Date): MissionRate[] {
  const vals = countedValidations(childEvents(f, childId));
  const rates = new Map<string, MissionRate>();
  for (let i = 0; i < 7; i++) {
    const date = addDays(now, -i);
    const key = dayKey(date);
    if (isPause(f, childId, key)) continue;
    for (const m of missionsOfDay(f, childId, date)) {
      if (m.oneOff) continue;
      const r = rates.get(m.id) ?? { mission: m, planned: 0, validated: 0 };
      r.planned++;
      if (vals.some((v) => v.missionId === m.id && v.day === key)) r.validated++;
      rates.set(m.id, r);
    }
  }
  return [...rates.values()];
}
