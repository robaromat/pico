// Les créatures de la forêt de Pico : une collection à débloquer, 1 créature tous les 10 bons points GAGNÉS
// (les achats dans la boutique ne font rien perdre). Ordre connu à l'avance : la suivante est visible en silhouette.
// 6 types × 4 stades : le stade 2 d'un type est l'évolution du stade 1, etc. Créatures originales, dessinées ici en SVG.

export type CreatureType = 'feu' | 'eau' | 'foudre' | 'plante' | 'lave' | 'glace';

export interface Creature {
  id: string;
  name: string;
  type: CreatureType;
  stage: 1 | 2 | 3 | 4;
  hp: number;
  atk: number;
  attack: string;
}

export const POINTS_PER_CREATURE = 10;

export const TYPE_INFO: Record<CreatureType, { label: string; emoji: string; color: string }> = {
  feu: { label: 'Feu', emoji: '🔥', color: '#FF7A3D' },
  eau: { label: 'Eau', emoji: '💧', color: '#4BA3F5' },
  foudre: { label: 'Foudre', emoji: '⚡', color: '#8A5CF5' },
  plante: { label: 'Plante', emoji: '🌿', color: '#4CAF57' },
  lave: { label: 'Lave', emoji: '🌋', color: '#C2410C' },
  glace: { label: 'Glace', emoji: '❄️', color: '#5BB8D8' },
};

const TYPES: CreatureType[] = ['feu', 'eau', 'foudre', 'plante', 'lave', 'glace'];

const NAMES: Record<CreatureType, [string, string, string, string]> = {
  feu: ['Braisou', 'Flamiche', 'Tisonix', 'Pyrodor'],
  eau: ['Gouttin', 'Clapoti', 'Vagueron', 'Océanor'],
  foudre: ['Zapi', 'Étincel', 'Voltigor', 'Fulgorax'],
  plante: ['Pousson', 'Feuillou', 'Ronceval', 'Sylvarbre'],
  lave: ['Magmi', 'Cendrou', 'Basaltor', 'Volcanox'],
  glace: ['Givrou', 'Floconnet', 'Cristalix', 'Banquizor'],
};

const ATTACKS: Record<CreatureType, [string, string, string, string]> = {
  feu: ['Petite étincelle', 'Souffle chaud', 'Boule de feu', 'Tempête de flammes'],
  eau: ['Bulle', "Jet d'eau", 'Grande vague', 'Raz-de-marée'],
  foudre: ['Picotement', 'Éclair', 'Coup de tonnerre', 'Orage géant'],
  plante: ['Lancer de graines', 'Fouet-liane', 'Tourbillon de feuilles', 'Forêt vivante'],
  lave: ['Braise', 'Coulée brûlante', 'Roche en fusion', 'Éruption'],
  glace: ['Flocon', 'Souffle givré', 'Blizzard', 'Grand froid'],
};

// Petites différences de caractère entre types (PV / attaque).
const BIAS: Record<CreatureType, [number, number]> = {
  feu: [0, 6],
  eau: [10, 0],
  foudre: [-5, 8],
  plante: [12, -2],
  lave: [8, 4],
  glace: [4, 2],
};

/** Toutes les créatures, dans l'ordre où elles se débloquent : les 6 bébés, puis les 6 évolutions, etc. */
export const CREATURES: Creature[] = [1, 2, 3, 4].flatMap((stage) =>
  TYPES.map((type) => ({
    id: `${type}${stage}`,
    name: NAMES[type][stage - 1]!,
    type,
    stage: stage as Creature['stage'],
    hp: 30 + stage * 20 + BIAS[type][0],
    atk: 8 + stage * 12 + BIAS[type][1],
    attack: ATTACKS[type][stage - 1]!,
  })),
);

export function previousForm(c: Creature): Creature | undefined {
  return c.stage > 1 ? CREATURES.find((x) => x.type === c.type && x.stage === c.stage - 1) : undefined;
}

export function nextForm(c: Creature): Creature | undefined {
  return CREATURES.find((x) => x.type === c.type && x.stage === c.stage + 1);
}

/** Nombre de créatures débloquées pour un total de points gagnés. */
export function unlockedCount(earned: number): number {
  return Math.min(CREATURES.length, Math.floor(Math.max(0, earned) / POINTS_PER_CREATURE));
}

/** Points qu'il reste à gagner avant la prochaine créature (null quand la collection est complète). */
export function pointsToNext(earned: number): number | null {
  if (unlockedCount(earned) >= CREATURES.length) return null;
  return POINTS_PER_CREATURE - (Math.max(0, earned) % POINTS_PER_CREATURE);
}

// ---------- Dessin ----------

interface Palette {
  body: string;
  belly: string;
  accent: string;
  dark: string;
}

const PAL: Record<CreatureType, Palette> = {
  feu: { body: '#FF7A3D', belly: '#FFD7A0', accent: '#FFC22E', dark: '#B93A12' },
  eau: { body: '#4BA3F5', belly: '#D2ECFF', accent: '#8FD3FF', dark: '#1D5FA8' },
  foudre: { body: '#B48CFF', belly: '#EFE6FF', accent: '#FFD23F', dark: '#5B3FA8' },
  plante: { body: '#5DBB63', belly: '#DDF5CF', accent: '#2F8F46', dark: '#1F5E30' },
  lave: { body: '#6A4646', belly: '#9A6A58', accent: '#FF6A2B', dark: '#2E1E1E' },
  glace: { body: '#A9E3F5', belly: '#F2FCFF', accent: '#7CCDE8', dark: '#2F6F8F' },
};

const INK = '#2B1E2E';

function flame(x: number, y: number, w: number, h: number, c1: string, c2: string): string {
  return `<path d="M${x - w} ${y} C${x - w} ${y - h * 0.5} ${x - w * 0.1} ${y - h * 0.55} ${x} ${y - h} C${x + w * 0.1} ${y - h * 0.55} ${x + w} ${y - h * 0.5} ${x + w} ${y} Z" fill="${c1}"/>
  <path d="M${x - w * 0.5} ${y} C${x - w * 0.5} ${y - h * 0.3} ${x} ${y - h * 0.35} ${x} ${y - h * 0.62} C${x} ${y - h * 0.35} ${x + w * 0.5} ${y - h * 0.3} ${x + w * 0.5} ${y} Z" fill="${c2}"/>`;
}

function leaf(x: number, y: number, len: number, angle: number, c: string, vein: string): string {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M0 0 C${len * 0.3} ${-len * 0.35} ${len * 0.75} ${-len * 0.3} ${len} 0 C${len * 0.75} ${len * 0.3} ${len * 0.3} ${len * 0.35} 0 0 Z" fill="${c}"/><path d="M2 0 L${len * 0.85} 0" stroke="${vein}" stroke-width="1.6" stroke-linecap="round"/></g>`;
}

function crystal(x: number, y: number, w: number, h: number, angle: number, c: string, shine: string): string {
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><polygon points="${-w},0 0,${-h} ${w},0 0,${h * 0.18}" fill="${c}"/><polygon points="0,${-h} ${w * 0.45},${-h * 0.2} 0,0" fill="${shine}" opacity=".7"/></g>`;
}

/** Le corps d'une créature (sans la balise <svg>), dans un repère 120 × 120. */
export function creatureArt(c: Creature): string {
  const p = PAL[c.type];
  const s = c.stage;
  const cx = 60;
  const cy = 72 - s; // un peu plus grand et plus haut aux derniers stades
  const rx = 24 + s * 3.5;
  const ry = 22 + s * 3.2;
  const top = cy - ry;
  const back: string[] = []; // derrière le corps
  const front: string[] = []; // devant le corps

  // ---- Attributs de chaque type ----
  if (c.type === 'feu') {
    const n = Math.min(3, s);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 11;
      back.push(flame(cx + off, top + 8, 8 + s, 18 + s * 4 - Math.abs(off) * 0.4, p.body, p.accent));
    }
    if (s >= 2) back.push(flame(cx + rx - 2, cy + 10, 6 + s, 16 + s * 3, p.dark, p.accent).replace(/<path/g, `<path transform="rotate(55 ${cx + rx - 2} ${cy + 10})"`));
  }
  if (c.type === 'eau') {
    back.push(`<path d="M${cx - 10} ${top + 6} Q${cx} ${top - 12 - s * 3} ${cx + 14} ${top + 6} Z" fill="${p.accent}"/>`);
    back.push(`<path d="M${cx + rx - 6} ${cy + 8} Q${cx + rx + 18} ${cy - 2} ${cx + rx + 12} ${cy + 22} Q${cx + rx + 4} ${cy + 16} ${cx + rx - 6} ${cy + 18} Z" fill="${p.accent}"/>`);
    if (s >= 3)
      for (const [bx, by, br] of [
        [cx - rx - 10, top + 10, 4],
        [cx - rx - 4, top - 2, 2.6],
        [cx + rx + 8, top + 2, 3.4],
      ] as const)
        front.push(`<circle cx="${bx}" cy="${by}" r="${br}" fill="none" stroke="${p.accent}" stroke-width="2"/>`);
  }
  if (c.type === 'foudre') {
    // Deux antennes terminées par une boule lumineuse, et une crête en zigzag (plus haute à chaque stade).
    const ah = 14 + s * 4;
    for (const k of [-1, 1]) {
      const bx = cx + k * (rx * 0.45 + 4);
      const tx = bx + k * 8;
      const ty = top - ah;
      back.push(`<path d="M${bx} ${top + 8} Q${bx + k * 2} ${top - ah * 0.5} ${tx} ${ty}" stroke="${p.dark}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
      back.push(`<circle cx="${tx}" cy="${ty}" r="${7 + s}" fill="${p.accent}" opacity=".35"/><circle cx="${tx}" cy="${ty}" r="${4 + s * 0.6}" fill="#FFF7D6"/>`);
    }
    const n = 2 + s;
    const w = rx * 0.9;
    const pts: string[] = [];
    for (let i = 0; i <= n * 2; i++) {
      const x = cx - w / 2 + (w * i) / (n * 2);
      const y = i % 2 ? top - 6 - s * 2 : top + 8;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    back.push(`<polygon points="${pts.join(' ')}" fill="${p.accent}"/>`);
    if (s >= 3) front.push(`<polygon points="${cx + 2},${cy + 6} ${cx - 6},${cy + 18} ${cx},${cy + 18} ${cx - 4},${cy + 28} ${cx + 8},${cy + 14} ${cx + 2},${cy + 14}" fill="${p.accent}"/>`);
  }
  if (c.type === 'plante') {
    const n = Math.min(3, s + 1);
    for (let i = 0; i < n; i++) back.push(leaf(cx, top + 6, 16 + s * 3, -90 + (i - (n - 1) / 2) * 38, p.accent, p.dark));
    if (s >= 3) {
      back.push(leaf(cx - rx + 6, top + 16, 14 + s * 2, -150, p.body, p.accent));
      back.push(leaf(cx + rx - 6, top + 16, 14 + s * 2, -30, p.body, p.accent));
    }
    if (s === 4) front.push(`<g transform="translate(${cx} ${top - 14})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-6" rx="4" ry="6" fill="#FF8FB1" transform="rotate(${a})"/>`).join('')}<circle r="3.6" fill="#FFC22E"/></g>`);
  }
  if (c.type === 'lave') {
    const hn = s >= 3 ? 2 : 1;
    for (let i = 0; i < hn; i++) {
      const hx = hn === 1 ? cx : cx + (i ? 12 : -12);
      back.push(`<polygon points="${hx - 7},${top + 8} ${hx + (hn === 1 ? 0 : i ? 4 : -4)},${top - 10 - s * 4} ${hx + 7},${top + 8}" fill="${p.dark}"/>`);
    }
    if (s >= 2) back.push(`<path d="M${cx + rx - 4} ${cy + 14} q16 -2 18 -16" stroke="${p.dark}" stroke-width="${7 + s}" fill="none" stroke-linecap="round"/>`);
  }
  if (c.type === 'glace') {
    const n = s + 1;
    for (let i = 0; i < n; i++) {
      const a = -150 + (120 * i) / Math.max(1, n - 1);
      const r = Math.PI / 180;
      back.push(crystal(cx + Math.cos(a * r) * rx * 0.8, cy + Math.sin(a * r) * ry * 0.8, 6 + s, 16 + s * 4, a + 90, p.accent, '#ffffff'));
    }
  }

  // ---- Corps commun : pieds, corps, ventre, bras, visage ----
  const feet = `<ellipse cx="${cx - rx * 0.45}" cy="${cy + ry - 2}" rx="${8 + s}" ry="5.5" fill="${p.dark}"/><ellipse cx="${cx + rx * 0.45}" cy="${cy + ry - 2}" rx="${8 + s}" ry="5.5" fill="${p.dark}"/>`;
  const body = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${p.body}"/>`;
  const belly = `<ellipse cx="${cx}" cy="${cy + ry * 0.3}" rx="${rx * 0.62}" ry="${ry * 0.55}" fill="${p.belly}"/>`;
  let extra = '';
  if (c.type === 'lave') {
    // Fissures qui brillent.
    extra += `<path d="M${cx - rx * 0.7} ${cy - 6} l8 4 l-3 7 l9 3" stroke="${p.accent}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    extra += `<path d="M${cx + rx * 0.55} ${cy - 10} l-6 6 l5 5" stroke="${p.accent}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (s >= 3) extra += `<path d="M${cx - 6} ${cy + ry * 0.55} l5 -6 l4 5 l5 -7" stroke="${p.accent}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (c.type === 'glace') extra += `<path d="M${cx - rx * 0.5} ${cy - ry * 0.55} q6 -6 14 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`;
  const arms =
    s >= 2
      ? `<ellipse cx="${cx - rx + 3}" cy="${cy + 6}" rx="6" ry="${8 + s}" fill="${p.body}" transform="rotate(25 ${cx - rx + 3} ${cy + 6})"/><ellipse cx="${cx + rx - 3}" cy="${cy + 6}" rx="6" ry="${8 + s}" fill="${p.body}" transform="rotate(-25 ${cx + rx - 3} ${cy + 6})"/>`
      : '';
  const ex = rx * 0.36;
  const ey = cy - ry * 0.12;
  const er = 7.2 - s * 0.5;
  const eyes = [-1, 1]
    .map(
      (k) =>
        `<ellipse cx="${cx + k * ex}" cy="${ey}" rx="${er}" ry="${er + 1}" fill="#fff"/><circle cx="${cx + k * ex + 1}" cy="${ey + 1}" r="${er * 0.62}" fill="${INK}"/><circle cx="${cx + k * ex + 2.4}" cy="${ey - 1.2}" r="${er * 0.24}" fill="#fff"/>`,
    )
    .join('');
  // Sourcils décidés à partir du stade 3.
  const brows =
    s >= 3
      ? `<path d="M${cx - ex - er} ${ey - er - 4} L${cx - ex + er} ${ey - er - 1}" stroke="${p.dark}" stroke-width="2.6" stroke-linecap="round"/><path d="M${cx + ex + er} ${ey - er - 4} L${cx + ex - er} ${ey - er - 1}" stroke="${p.dark}" stroke-width="2.6" stroke-linecap="round"/>`
      : '';
  const cheeks = `<circle cx="${cx - ex - 4}" cy="${ey + er + 5}" r="3.6" fill="#FF8E8E" opacity=".5"/><circle cx="${cx + ex + 4}" cy="${ey + er + 5}" r="3.6" fill="#FF8E8E" opacity=".5"/>`;
  const mouth =
    s >= 4
      ? `<path d="M${cx - 6} ${ey + er + 6} q6 7 12 0 z" fill="#6B2433"/><path d="M${cx - 4} ${ey + er + 6} l2 3 l2 -3 M${cx + 1} ${ey + er + 6} l2 3 l2 -3" fill="#fff"/>`
      : `<path d="M${cx - 5} ${ey + er + 5} q5 5 10 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  // Stade 4 : une petite couronne de lumière.
  const aura = s === 4 ? `<ellipse cx="${cx}" cy="${cy + ry + 1}" rx="${rx + 10}" ry="6" fill="${p.accent}" opacity=".35"/>` : '';

  return `${aura}${back.join('')}${feet}${body}${belly}${extra}${arms}${front.join('')}${eyes}${brows}${cheeks}${mouth}`;
}

export function creatureSvg(c: Creature, cls = ''): string {
  return `<svg class="crea ${cls}" viewBox="0 0 120 120" aria-hidden="true"><ellipse cx="60" cy="108" rx="34" ry="5" fill="rgba(43,33,64,.12)"/>${creatureArt(c)}</svg>`;
}
