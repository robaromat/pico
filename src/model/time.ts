import type { Moment, Settings } from './types';

// Jours et moments de la journée, toujours en heure locale de l'appareil.

const pad = (n: number) => String(n).padStart(2, '0');

/** « AAAA-MM-JJ » local. */
export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Minutes depuis minuit pour « HH:MM ». */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** « 20:00 » → « 20 h », « 21:30 » → « 21 h 30 ». */
export function hourLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}

export type Period = Moment | 'nuit';

export function scheduleFor(s: Settings, d: Date) {
  return s.freeDays.includes(d.getDay()) ? s.free : s.school;
}

/** Moment de la journée selon les horaires (sans tenir compte d'une soirée spéciale). */
export function periodAt(s: Settings, d: Date): Period {
  const t = minutesOf(d);
  const sch = scheduleFor(s, d);
  if (t < toMinutes(s.wakeup) || t >= toMinutes(s.bedtime)) return 'nuit';
  if (t < toMinutes(sch.matin)) return 'matin';
  if (t < toMinutes(sch.aprem)) return 'aprem';
  return 'soir';
}

export const MOMENT_LABEL: Record<Period | 'jour', string> = {
  matin: 'Matin',
  aprem: 'Après-midi',
  soir: 'Soir',
  nuit: 'Nuit',
  jour: 'Toute la journée',
};

export const WEEKDAYS_SHORT = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];

/** Les 7 jours de la semaine en cours (lundi → dimanche), clés « AAAA-MM-JJ ». */
export function weekDays(today: Date = new Date()): { key: string; date: Date }[] {
  const monday = new Date(today);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: dayKey(d), date: d };
  });
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** « samedi 21 nov. » */
export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}
