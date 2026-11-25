// Format du fichier pico.json, rangé dans le dépôt de données privé.
// Tout ce qui change est une liste d'entrées avec un identifiant : la fusion entre appareils se fait entrée par entrée.
// Les points ne sont jamais stockés : ils sont recalculés à partir du journal d'événements (rules.ts).

export type Moment = 'matin' | 'aprem' | 'soir';
/** Moment affiché : un défi ponctuel peut valoir pour toute la journée. */
export type MissionMoment = Moment | 'jour';

/** Les jeux de Pico. */
export type GameId = 'course' | 'espace' | 'verger';

export interface Schedule {
  /** Fin du matin (début de l'après-midi), « HH:MM ». */
  matin: string;
  /** Fin de l'après-midi (début du soir). */
  aprem: string;
}

export interface Settings {
  codeHash: string;
  codeSalt: string;
  /** Heure du coucher : Pico dort, ni missions ni jeu. */
  bedtime: string;
  /** Heure du réveil : avant, c'est encore la nuit. */
  wakeup: string;
  school: Schedule;
  free: Schedule;
  /** Jours sans école (0 = dimanche … 6 = samedi). */
  freeDays: number[];
  sound: boolean;
  updatedAt: string;
}

export interface Child {
  id: string;
  name: string;
  /** Couleur de l'écharpe de Pico, choisie par l'enfant pendant l'intro. */
  scarf: string;
  introDone: boolean;
  startPoints: number;
  /** Récompense épinglée comme « rêve » (jauge sur l'accueil). */
  dreamId: string | null;
  /** Niveau de difficulté du jeu (0,75 à 1,3), ajusté après chaque partie. */
  level: number;
  /** Meilleur score de la course (ancien champ, gardé pour la compatibilité). */
  best: number;
  /** Meilleur score de chaque jeu. */
  bests: Record<string, number>;
  updatedAt: string;
}

export interface Mission {
  id: string;
  childId: string;
  title: string;
  emoji: string;
  points: number;
  givesGame: boolean;
  moment: MissionMoment;
  /** Jours de la semaine où la mission est proposée (0 = dimanche). */
  days: number[];
  active: boolean;
  /** Visible sur la tablette seulement à partir de cette heure (« HH:MM »), par ex. un bilan du vendredi 16 h. */
  from?: string;
  /** Défi ponctuel : seulement le jour `date`. */
  oneOff?: boolean;
  date?: string;
  deleted?: boolean;
  updatedAt: string;
}

export interface Reward {
  id: string;
  title: string;
  emoji: string;
  price: number;
  active: boolean;
  deleted?: boolean;
  updatedAt: string;
}

interface EventBase {
  id: string;
  childId: string;
  /** Horodatage ISO. */
  at: string;
  /** Jour local « AAAA-MM-JJ » où l'événement a eu lieu. */
  day: string;
}

export type PicoEvent = EventBase &
  (
    | { type: 'declare'; missionId: string }
    | { type: 'validate'; declareId: string; missionId: string; points: number; game: boolean }
    | { type: 'refuse'; declareId: string }
    | { type: 'surprise'; points: number; text: string }
    | { type: 'purchase'; rewardId: string; title: string; emoji: string; price: number }
    | { type: 'correct'; delta: number; note: string }
    | { type: 'play'; gameId: string; score: number }
    | { type: 'pause'; on: boolean }
    | { type: 'special'; on: boolean; until: string }
  );

export type EventType = PicoEvent['type'];

export interface PicoFile {
  schemaVersion: 1;
  settings: Settings;
  children: Child[];
  missions: Mission[];
  rewards: Reward[];
  events: PicoEvent[];
}
