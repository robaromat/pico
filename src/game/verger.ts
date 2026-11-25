import { picoImage } from '../ui/Pico';
import { blip } from '../ui/fx';
import { companionImage, drawCompanion, drawShield, follow, H, hud, runLoop, W, type GameRunner } from './kit';

// « Le verger de Pico » : Pico tient un panier en bas de l'écran (le doigt le déplace).
// Il attrape les pommes (+1) et les glands dorés (+3), et évite les pommes de pin qui piquent.
// Une pomme ratée ne coûte rien : seule une pomme de pin dans le panier fait perdre une vie.

const GROUND = 440;

export const runVerger: GameRunner = (cv, opts) => {
  const dur = opts.duration ?? 60;
  const lvl = opts.level;
  const img = picoImage('hello', opts.scarf);
  const imgH = picoImage('happy', opts.scarf);
  const comp = companionImage(opts.companion);
  let shield = !!comp;
  let compX = W / 2;
  type Fruit = { x: number; y: number; vy: number; k: 'a' | 'g' | 'p'; rot: number };
  type Pop = { x: number; y: number; t: number; txt: string };
  let fruits: Fruit[] = [];
  let pops: Pop[] = [];
  const s = { x: W / 2, lives: 3, score: 0, inv: 0, spawn: 0.6, happy: 0 };

  return runLoop(cv, dur, ({ x, pointerX }) => ({
    step(dt, t) {
      s.x = follow(s.x, pointerX(), 1000, dt, 60, W - 60);
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const r = Math.random();
        const k: Fruit['k'] = r < 0.08 ? 'g' : r < 0.08 + Math.min(0.38, 0.22 + t / 300) * lvl ? 'p' : 'a';
        fruits.push({ x: 50 + Math.random() * (W - 100), y: 70, vy: (140 + Math.random() * 60 + t * 1.6) * lvl, k, rot: Math.random() * 6 });
        s.spawn = (0.85 - Math.min(0.35, t / 150)) / lvl + Math.random() * 0.35;
      }
      for (const f of fruits) {
        f.y += f.vy * dt;
        f.rot += dt * 2;
      }
      if (s.inv > 0) s.inv -= dt;
      if (s.happy > 0) s.happy -= dt;
      // Le panier, que Pico porte au-dessus de sa tête.
      for (const f of fruits) {
        if (f.y > GROUND - 128 && f.y < GROUND - 88 && Math.abs(f.x - s.x) < 56) {
          if (f.k === 'p') {
            if (s.inv <= 0) {
              pops.push({ x: f.x, y: f.y, t: 0, txt: shield ? 'Protégé !' : 'Aïe !' });
              if (shield) shield = false;
              else s.lives--;
              s.inv = 1.4;
              navigator.vibrate?.(80);
            }
          } else {
            const n = f.k === 'g' ? 3 : 1;
            s.score += n;
            s.happy = 0.4;
            pops.push({ x: f.x, y: f.y, t: 0, txt: '+' + n });
            blip(opts.sound, f.k === 'g' ? 1318 : 1046);
          }
          f.y = H + 100;
        }
      }
      fruits = fruits.filter((f) => f.y < GROUND + 40);
      for (const p of pops) p.t += dt;
      pops = pops.filter((p) => p.t < 0.7);
      return s.lives <= 0;
    },

    draw(t) {
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#BEE6FF');
      sky.addColorStop(1, '#FFF4DC');
      x.fillStyle = sky;
      x.fillRect(0, 0, W, H);
      // Le feuillage du grand pommier, en haut.
      x.fillStyle = '#57AE78';
      for (let i = 0; i < 9; i++) {
        x.beginPath();
        x.arc(i * 100 + 10, 20 + (i % 2) * 18, 70, 0, 7);
        x.fill();
      }
      x.fillStyle = '#3E8E5E';
      for (let i = 0; i < 9; i++) {
        x.beginPath();
        x.arc(i * 100 + 60, 0, 50, 0, 7);
        x.fill();
      }
      x.fillStyle = '#E8475B';
      for (let i = 0; i < 7; i++) {
        x.beginPath();
        x.arc(i * 120 + 40, 60 + ((i * 23) % 20), 8, 0, 7);
        x.fill();
      }
      // L'herbe.
      x.fillStyle = '#6CC36A';
      x.fillRect(0, GROUND, W, H - GROUND);
      x.fillStyle = '#5DB35B';
      for (let i = 0; i < 40; i++) x.fillRect(i * 20 + ((i * 7) % 11), GROUND + 8 + ((i * 13) % 30), 4, 10);

      for (const f of fruits) drawFruit(x, f.x, f.y, f.k, f.rot);

      // Pico et son panier.
      const blink = s.inv > 0 && Math.floor(s.inv * 10) % 2;
      if (!blink) {
        const im = s.happy > 0 ? imgH : img;
        if (im.complete) x.drawImage(im, s.x - 50, GROUND - 92, 100, 100);
        const B = GROUND - 118; // haut du panier
        x.fillStyle = '#C98A4B';
        x.beginPath();
        x.moveTo(s.x - 56, B);
        x.lineTo(s.x + 56, B);
        x.lineTo(s.x + 44, B + 36);
        x.lineTo(s.x - 44, B + 36);
        x.closePath();
        x.fill();
        x.strokeStyle = '#8A5530';
        x.lineWidth = 3;
        for (let i = -2; i <= 2; i++) {
          x.beginPath();
          x.moveTo(s.x + i * 20, B);
          x.lineTo(s.x + i * 16, B + 36);
          x.stroke();
        }
        x.beginPath();
        x.moveTo(s.x - 56, B);
        x.lineTo(s.x + 56, B);
        x.stroke();
        // Les deux pattes qui tiennent le panier.
        x.strokeStyle = '#B96A34';
        x.lineWidth = 7;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(s.x - 4, GROUND - 52);
        x.lineTo(s.x - 30, B + 34);
        x.moveTo(s.x + 34, GROUND - 46);
        x.lineTo(s.x + 34, B + 34);
        x.stroke();
      }
      x.textAlign = 'center';
      x.font = '800 28px "Baloo 2", sans-serif';
      for (const p of pops) {
        x.fillStyle = p.txt.startsWith('+') ? `rgba(47,165,106,${1 - p.t})` : p.txt.startsWith('P') ? `rgba(60,147,232,${1 - p.t})` : `rgba(232,71,91,${1 - p.t})`;
        x.fillText(p.txt, p.x, p.y - 30 - p.t * 50);
      }
      if (comp) {
        const side = s.x > W / 2 ? -1 : 1;
        compX += (s.x + side * 90 - compX) * 0.05;
        drawCompanion(x, comp, compX, GROUND - 36, 92, t);
        if (shield) drawShield(x, s.x, GROUND - 70, 74, t);
      }
      hud(x, { lives: s.lives, t, duration: dur, score: '🍎 ' + s.score, hint: 'Glisse ton doigt pour attraper !' });
      if (comp && shield) {
        x.font = '800 26px "Baloo 2", sans-serif';
        x.textAlign = 'left';
        x.fillText('🛡️', 130, 34);
      }
    },

    result: (t) => ({ score: s.score, lives: Math.max(0, s.lives), seconds: Math.round(t) }),
  }));
};

function drawFruit(x: CanvasRenderingContext2D, fx: number, fy: number, k: 'a' | 'g' | 'p', rot: number) {
  if (k === 'a') {
    x.fillStyle = '#E8475B';
    x.beginPath();
    x.arc(fx, fy, 16, 0, 7);
    x.fill();
    x.fillStyle = '#2FA56A';
    x.beginPath();
    x.ellipse(fx + 7, fy - 17, 8, 4, -0.6, 0, 7);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.beginPath();
    x.arc(fx - 5, fy - 5, 4, 0, 7);
    x.fill();
  } else if (k === 'g') {
    x.fillStyle = 'rgba(255,226,122,.45)';
    x.beginPath();
    x.arc(fx, fy, 26, 0, 7);
    x.fill();
    x.fillStyle = '#FFC22E';
    x.beginPath();
    x.ellipse(fx, fy + 4, 12, 14, 0, 0, 7);
    x.fill();
    x.fillStyle = '#C98A1B';
    x.beginPath();
    x.ellipse(fx, fy - 7, 14, 8, 0, 0, 7);
    x.fill();
  } else {
    // Pomme de pin : écailles qui piquent.
    x.save();
    x.translate(fx, fy);
    x.rotate(Math.sin(rot) * 0.3);
    x.fillStyle = '#7A4A2A';
    x.beginPath();
    x.ellipse(0, 0, 14, 20, 0, 0, 7);
    x.fill();
    x.fillStyle = '#A8743F';
    for (let r = -2; r <= 2; r++)
      for (let c = -1; c <= 1; c++) {
        x.beginPath();
        x.moveTo(c * 8 - 4, r * 8);
        x.lineTo(c * 8, r * 8 + 6);
        x.lineTo(c * 8 + 4, r * 8);
        x.fill();
      }
    x.restore();
  }
}
