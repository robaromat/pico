// Outils communs aux jeux de Pico : toile 800 × 500 mise à l'échelle, boucle d'animation,
// doigt qui glisse (position horizontale), bandeau du haut (vies, temps, score) et fin de partie.

export interface GameResult {
  score: number;
  lives: number;
  seconds: number;
}

export interface GameOptions {
  scarf: string;
  /** Difficulté adaptative (0,75 à 1,3). */
  level: number;
  sound: boolean;
  duration?: number;
}

export type GameRunner = (cv: HTMLCanvasElement, opts: GameOptions) => { done: Promise<GameResult>; stop: () => void };

export const W = 800;
export const H = 500;

export interface Loop {
  x: CanvasRenderingContext2D;
  /** Position horizontale du doigt (repère 800 × 500), ou null si aucun doigt. */
  pointerX: () => number | null;
}

/**
 * Lance la boucle : `step(dt, t)` fait avancer le jeu et renvoie true quand la partie est finie,
 * `draw()` dessine l'image. La partie se termine aussi au bout de `duration` secondes.
 */
export function runLoop(
  cv: HTMLCanvasElement,
  duration: number,
  setup: (l: Loop) => { step: (dt: number, t: number) => boolean; draw: (t: number) => void; result: (t: number) => GameResult },
): { done: Promise<GameResult>; stop: () => void } {
  const x = cv.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  x.scale(dpr, dpr);

  let px: number | null = null;
  const toX = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    px = toX(e);
    cv.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (px !== null || e.pointerType === 'mouse') px = toX(e);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') px = null;
  };
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.style.touchAction = 'none';

  const g = setup({ x, pointerX: () => px });
  let resolve!: (r: GameResult) => void;
  const done = new Promise<GameResult>((r) => (resolve = r));
  let t = 0;
  let last = performance.now();
  let raf = 0;
  let over = false;

  function cleanup() {
    cv.removeEventListener('pointerdown', onDown);
    cv.removeEventListener('pointermove', onMove);
    cv.removeEventListener('pointerup', onUp);
    cv.removeEventListener('pointercancel', onUp);
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    if (g.step(dt, t) || t >= duration) {
      over = true;
      cleanup();
      resolve(g.result(t));
    }
    g.draw(t);
    if (!over) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    done,
    stop: () => {
      cancelAnimationFrame(raf);
      cleanup();
    },
  };
}

/** Bandeau du haut : cœurs, barre de temps, score, et la consigne pendant les premières secondes. */
export function hud(x: CanvasRenderingContext2D, o: { lives: number; t: number; duration: number; score: string; hint: string; dark?: boolean }) {
  x.font = '800 30px "Baloo 2", sans-serif';
  x.textBaseline = 'middle';
  x.textAlign = 'left';
  const l = Math.max(0, o.lives);
  x.fillStyle = '#E8475B';
  x.fillText('❤'.repeat(l) + '♡'.repeat(Math.max(0, 3 - l)), 20, 34);
  x.fillStyle = o.dark ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.75)';
  x.fillRect(250, 24, 300, 18);
  x.fillStyle = '#3C93E8';
  x.fillRect(250, 24, 300 * Math.max(0, 1 - o.t / o.duration), 18);
  x.fillStyle = o.dark ? '#fff' : '#2B2140';
  x.textAlign = 'right';
  x.fillText(o.score, W - 20, 34);
  if (o.t < 2.6) {
    x.fillStyle = o.dark ? 'rgba(255,255,255,.9)' : 'rgba(43,33,64,.8)';
    x.font = '800 34px "Baloo 2", sans-serif';
    x.textAlign = 'center';
    x.fillText(o.hint, W / 2, 150);
  }
}

/** Rapproche doucement `from` de la cible (le personnage suit le doigt sans téléporter). */
export function follow(from: number, target: number | null, maxSpeed: number, dt: number, min: number, max: number): number {
  if (target === null) return from;
  const d = Math.max(min, Math.min(max, target)) - from;
  const step = Math.sign(d) * Math.min(Math.abs(d), maxSpeed * dt);
  return from + step;
}
