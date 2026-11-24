import { picoImage } from '../ui/Pico';
import { blip } from '../ui/fx';

// « La course de Pico » : Pico court dans la forêt, on touche l'écran pour sauter.
// Pommes et glands à ramasser, souches et flaques à éviter. 60 s ou 3 vies, puis fin nette.
// Canvas en JavaScript pur, dessiné dans un repère fixe 800 × 500 (mis à l'échelle de l'écran).

export interface CourseResult {
  score: number;
  lives: number;
  seconds: number;
}

export interface CourseOptions {
  scarf: string;
  /** Difficulté adaptative (0,75 à 1,3). */
  level: number;
  sound: boolean;
  duration?: number;
}

const W = 800;
const H = 500;
const GROUND = 410;

export function runCourse(cv: HTMLCanvasElement, opts: CourseOptions): { done: Promise<CourseResult>; stop: () => void } {
  const x = cv.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  x.scale(dpr, dpr);

  const img = picoImage('hello', opts.scarf);
  const imgJ = picoImage('happy', opts.scarf);
  const lvl = opts.level;
  const g = { t: 0, dur: opts.duration ?? 60, lives: 3, score: 0, y: GROUND, vy: 0, inv: 0, spO: 1.6, spI: 0.6, speed: 270 * lvl, off: 0, over: false };
  type Obs = { k: 's' | 'p'; x: number; w: number; h: number };
  type Item = { x: number; y: number; k: 'a' | 'g'; got?: boolean };
  let obs: Obs[] = [];
  let items: Item[] = [];
  const P = { x: 120, w: 92, h: 92 };
  const trees = Array.from({ length: 7 }, (_, i) => ({ x: i * 140 + Math.random() * 60, s: 0.8 + Math.random() * 0.5, c: ['#FF9D3C', '#E8603C', '#FFC22E', '#D9472B'][i % 4]! }));

  const jump = () => {
    if (g.over) return;
    if (g.y >= GROUND - 1) {
      g.vy = -760;
      blip(opts.sound, 520);
    }
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    jump();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      jump();
    }
  };
  cv.addEventListener('pointerdown', onDown);
  window.addEventListener('keydown', onKey);

  function drawBg() {
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#AEE0FF');
    sky.addColorStop(1, '#FFF0D8');
    x.fillStyle = sky;
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#FFE27A';
    x.beginPath();
    x.arc(680, 80, 38, 0, 7);
    x.fill();
    x.fillStyle = '#A9D99B';
    const o1 = (g.off * 0.2) % 400;
    for (let i = -1; i < 4; i++) {
      x.beginPath();
      x.ellipse(i * 400 - o1 + 200, GROUND + 20, 260, 120, 0, Math.PI, 0);
      x.fill();
    }
    for (const tr of trees) {
      const tx = (((tr.x - g.off * 0.5) % 980) + 980) % 980 - 90;
      x.fillStyle = '#7A4A2A';
      x.fillRect(tx - 6, GROUND - 90 * tr.s, 12, 90 * tr.s);
      x.fillStyle = tr.c;
      x.beginPath();
      x.arc(tx, GROUND - 100 * tr.s, 42 * tr.s, 0, 7);
      x.fill();
    }
    x.fillStyle = '#6CC36A';
    x.fillRect(0, GROUND + 38, W, 14);
    x.fillStyle = '#A8743F';
    x.fillRect(0, GROUND + 52, W, H);
    x.fillStyle = '#93622F';
    const o2 = g.off % 60;
    for (let i = 0; i < 15; i++) x.fillRect(i * 60 - o2, GROUND + 70, 18, 5);
  }

  function drawThings() {
    for (const o of obs) {
      if (o.k === 's') {
        x.fillStyle = '#8A5530';
        x.fillRect(o.x, GROUND + 38 - o.h, o.w, o.h);
        x.fillStyle = '#D9A66B';
        x.beginPath();
        x.ellipse(o.x + o.w / 2, GROUND + 38 - o.h, o.w / 2, 8, 0, 0, 7);
        x.fill();
        x.strokeStyle = '#A8743F';
        x.lineWidth = 2;
        x.beginPath();
        x.ellipse(o.x + o.w / 2, GROUND + 38 - o.h, o.w / 4, 4, 0, 0, 7);
        x.stroke();
      } else {
        x.fillStyle = '#5BB4F0';
        x.beginPath();
        x.ellipse(o.x + o.w / 2, GROUND + 38, o.w / 2, o.h / 2 + 2, 0, 0, 7);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,.6)';
        x.fillRect(o.x + 18, GROUND + 35, 16, 3);
      }
    }
    for (const it of items) {
      if (it.k === 'a') {
        x.fillStyle = '#E8475B';
        x.beginPath();
        x.arc(it.x, it.y, 14, 0, 7);
        x.fill();
        x.fillStyle = '#2FA56A';
        x.beginPath();
        x.ellipse(it.x + 6, it.y - 15, 7, 4, -0.6, 0, 7);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,.5)';
        x.beginPath();
        x.arc(it.x - 5, it.y - 4, 4, 0, 7);
        x.fill();
      } else {
        x.fillStyle = '#B5672F';
        x.beginPath();
        x.ellipse(it.x, it.y + 3, 11, 13, 0, 0, 7);
        x.fill();
        x.fillStyle = '#6E4125';
        x.beginPath();
        x.ellipse(it.x, it.y - 7, 13, 7, 0, 0, 7);
        x.fill();
      }
    }
  }

  function drawHud() {
    x.font = '800 30px "Baloo 2", sans-serif';
    x.textBaseline = 'middle';
    x.textAlign = 'left';
    const l = Math.max(0, g.lives);
    x.fillStyle = '#E8475B';
    x.fillText('❤'.repeat(l) + '♡'.repeat(3 - l), 20, 34);
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.fillRect(250, 24, 300, 18);
    x.fillStyle = '#3C93E8';
    x.fillRect(250, 24, 300 * Math.max(0, 1 - g.t / g.dur), 18);
    x.fillStyle = '#2B2140';
    x.textAlign = 'right';
    x.fillText('🍎 ' + g.score, W - 20, 34);
    if (g.t < 2.4 && !g.over) {
      x.fillStyle = 'rgba(43,33,64,.8)';
      x.font = '800 34px "Baloo 2", sans-serif';
      x.textAlign = 'center';
      x.fillText("Touche l'écran pour sauter !", W / 2, 150);
    }
  }

  let resolve!: (r: CourseResult) => void;
  const done = new Promise<CourseResult>((r) => (resolve = r));
  let last = performance.now();
  let raf = 0;

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!g.over) {
      g.t += dt;
      g.speed = 270 * lvl + g.t * 2.2;
      g.off += g.speed * dt;
      g.vy += 2000 * dt;
      g.y = Math.min(GROUND, g.y + g.vy * dt);
      if (g.y >= GROUND) g.vy = 0;
      g.spO -= dt;
      if (g.spO <= 0) {
        obs.push(Math.random() < 0.4 ? { k: 'p', x: W + 20, w: 70, h: 14 } : { k: 's', x: W + 20, w: 40, h: 46 });
        g.spO = (1.3 + Math.random() * 1.1) / lvl;
      }
      g.spI -= dt;
      if (g.spI <= 0) {
        items.push({ x: W + 20, y: Math.random() < 0.45 ? GROUND - 150 : GROUND + 5, k: Math.random() < 0.7 ? 'a' : 'g' });
        g.spI = 0.7 + Math.random() * 0.8;
      }
      for (const o of obs) o.x -= g.speed * dt;
      for (const it of items) it.x -= g.speed * dt;
      obs = obs.filter((o) => o.x > -100);
      items = items.filter((o) => o.x > -40 && !o.got);
      if (g.inv > 0) g.inv -= dt;
      const px = P.x + 22,
        pw = P.w - 44,
        py = g.y - P.h + 26,
        ph = P.h - 30;
      for (const o of obs) {
        const ox = o.x + 6,
          ow = o.w - 12,
          oy = GROUND + 38 - o.h;
        if (g.inv <= 0 && px < ox + ow && px + pw > ox && py < oy + o.h && py + ph > oy) {
          g.lives--;
          g.inv = 1.4;
          navigator.vibrate?.(80);
        }
      }
      for (const it of items) {
        if (Math.abs(P.x + P.w / 2 - it.x) < 40 && Math.abs(g.y - P.h / 2 + 10 - it.y) < 52) {
          it.got = true;
          g.score++;
          blip(opts.sound, 1046);
        }
      }
      if (g.t >= g.dur || g.lives <= 0) {
        g.over = true;
        cleanup();
        resolve({ score: g.score, lives: Math.max(0, g.lives), seconds: Math.round(g.t) });
      }
    }
    drawBg();
    drawThings();
    const bob = g.y >= GROUND ? Math.sin(g.t * 18) * 3 : 0;
    if (!(g.inv > 0 && Math.floor(g.inv * 10) % 2)) {
      const im = g.y < GROUND ? imgJ : img;
      if (im.complete) x.drawImage(im, P.x, g.y - P.h + bob + 12, P.w, P.h);
    }
    drawHud();
    if (!g.over) raf = requestAnimationFrame(frame);
  }

  function cleanup() {
    cv.removeEventListener('pointerdown', onDown);
    window.removeEventListener('keydown', onKey);
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
