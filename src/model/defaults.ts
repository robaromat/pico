import type { Child, Mission, MissionMoment, PicoFile, Reward, Settings } from './types';

// Contenu de départ : bibliothèque de missions (formulations positives) et boutique d'exemple.
// Les parents activent celles qu'ils veulent (5 au maximum par moment) et peuvent tout modifier.

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const SCHOOL_DAYS = [1, 2, 4, 5];

type Lib = [emoji: string, title: string, points: number, moment: MissionMoment, active: boolean, days?: number[]];

export const MISSION_LIBRARY: Lib[] = [
  ['👕', "S'habiller seul", 1, 'matin', true],
  ['🦷', 'Se brosser les dents', 1, 'matin', true],
  ['👟', 'Mettre ses chaussures du 1er coup', 2, 'matin', true],
  ['🎒', 'Préparer son cartable', 1, 'matin', false, SCHOOL_DAYS],
  ['🥣', 'Finir son petit-déj', 1, 'matin', false],
  ['📚', 'Faire ses devoirs', 2, 'aprem', true, SCHOOL_DAYS],
  ['🧸', 'Ranger ses jouets', 1, 'aprem', true],
  ['🍽️', 'Mettre la table', 1, 'aprem', true],
  ['🧺', 'Mettre son linge au sale', 1, 'aprem', false],
  ['🤝', 'Jouer gentiment avec son frère', 2, 'aprem', false],
  ['🛁', 'Prendre son bain sans discuter', 2, 'soir', true],
  ['🦷', 'Se brosser les dents', 1, 'soir', true],
  ['🌙', "Aller au lit à l'heure", 2, 'soir', true],
  ['📖', 'Lire 10 minutes', 1, 'soir', false],
  ['😴', 'Rester dans son lit', 1, 'soir', false],
];

const REWARDS: [string, string, number][] = [
  ['🍨', 'Choisir le dessert', 5],
  ['🎬', 'Choisir le film du soir', 10],
  ['🎲', 'Jeu de société avec Papa ou Maman', 15],
  ['🎂', 'Faire un gâteau ensemble', 20],
  ['🛝', 'Sortie au parc', 30],
  ['🧩', 'Un petit jouet', 60],
];

export const SCARVES = ['#FFC22E', '#E8475B', '#3C93E8', '#2FA56A', '#8A5CF5'];

export const MISSION_EMOJIS = ['⭐', '🤝', '🧹', '🐶', '🎨', '💬', '🧸', '📚', '🦷', '👕', '🍽️', '🛁', '🌙', '🚲', '🎵', '🌱'];
export const REWARD_EMOJIS = ['🎁', '🍨', '🎬', '🎲', '🎂', '🛝', '🧩', '📚', '🍕', '🏊', '🎨', '🚲'];

export function defaultSettings(now: string): Omit<Settings, 'codeHash' | 'codeSalt'> {
  return {
    bedtime: '20:00',
    wakeup: '06:00',
    school: { matin: '12:00', aprem: '18:00' },
    free: { matin: '12:00', aprem: '18:00' },
    freeDays: [0, 3, 6],
    sound: true,
    updatedAt: now,
  };
}

export function newFile(opts: { childName: string; startPoints: number; codeHash: string; codeSalt: string; now: string }): PicoFile {
  const { now } = opts;
  const child: Child = {
    id: 'c1',
    name: opts.childName,
    scarf: SCARVES[0]!,
    introDone: false,
    startPoints: opts.startPoints,
    dreamId: null,
    level: 1,
    best: 0,
    updatedAt: now,
  };
  const missions: Mission[] = MISSION_LIBRARY.map(([emoji, title, points, moment, active, days], i) => ({
    id: `m${i + 1}`,
    childId: child.id,
    title,
    emoji,
    points,
    // Missions du soir : pas de partie (elle serait perdue, l'heure du coucher arrive).
    givesGame: moment !== 'soir',
    moment,
    days: days ?? ALL_DAYS,
    active,
    updatedAt: now,
  }));
  const rewards: Reward[] = REWARDS.map(([emoji, title, price], i) => ({ id: `r${i + 1}`, emoji, title, price, active: true, updatedAt: now }));
  return {
    schemaVersion: 1,
    settings: { ...defaultSettings(now), codeHash: opts.codeHash, codeSalt: opts.codeSalt },
    children: [child],
    missions,
    rewards,
    events: [],
  };
}
