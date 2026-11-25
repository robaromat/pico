import { picoImage } from '../ui/Pico';
import { blip } from '../ui/fx';
import { companionImage, drawCompanion, drawShield, follow, H, hud, runLoop, W, type GameRunner } from './kit';

// « Pico dans les étoiles » : Pico pilote sa fusée-gland en bas de l'écran (le doigt la déplace)
// et lance tout seul des graines lumineuses. On pulvérise les cailloux de l'espace avant qu'ils touchent la fusée.
// Un caillou qui passe à côté ne coûte rien : seule la fusée touchée fait perdre une vie.

const SHIP_Y = 430;

export const runEspace: GameRunner = (cv, opts) => {
  const dur = opts.duration ?? 60;
  const lvl = opts.level;
  const img = picoImage('happy', opts.scarf);
  const comp = companionImage(opts.companion);
  let shield = !!comp;
  let compX = W / 2;
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.8 + 0.4, s: 20 + Math.random() * 40 }));
  type Rock = { x: number; y: number; r: number; vy: number; vx: number; rot: number; hp: number };
  type Shot = { x: number; y: number };
  type Pop = { x: number; y: number; t: number };
  let rocks: Rock[] = [];
  let shots: Shot[] = [];
  let pops: Pop[] = [];
  const s = { x: W / 2, lives: 3, score: 0, inv: 0, fire: 0, spawn: 1, tilt: 0 };

  return runLoop(cv, dur, ({ x, pointerX }) => ({
    step(dt, t) {
      const before = s.x;
      s.x = follow(s.x, pointerX(), 900, dt, 50, W - 50);
      s.tilt = Math.max(-0.35, Math.min(0.35, (s.x - before) / (dt * 2600 || 1)));
      for (const st of stars) {
        st.y += st.s * dt;
        if (st.y > H) st.y = 0;
      }
      // Tir automatique.
      s.fire -= dt;
      if (s.fire <= 0) {
        shots.push({ x: s.x, y: SHIP_Y - 60 });
        s.fire = 0.32;
      }
      for (const sh of shots) sh.y -= 620 * dt;
      shots = shots.filter((sh) => sh.y > -20);
      // Cailloux : un peu plus nombreux au fil de la partie, selon le niveau.
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const big = Math.random() < 0.3;
        rocks.push({ x: 40 + Math.random() * (W - 80), y: -40, r: big ? 34 : 22, vy: (90 + Math.random() * 70 + t * 1.2) * lvl, vx: (Math.random() - 0.5) * 50, rot: Math.random() * 6, hp: big ? 2 : 1 });
        s.spawn = (1.05 - Math.min(0.45, t / 120)) / lvl + Math.random() * 0.4;
      }
      for (const r of rocks) {
        r.y += r.vy * dt;
        r.x += r.vx * dt;
        r.rot += dt;
        if (r.x < r.r || r.x > W - r.r) r.vx = -r.vx;
      }
      // Graines contre cailloux.
      for (const r of rocks)
        for (const sh of shots) {
          if (r.hp > 0 && sh.y > -10 && Math.hypot(r.x - sh.x, r.y - sh.y) < r.r + 6) {
            sh.y = -100;
            r.hp--;
            if (r.hp <= 0) {
              s.score++;
              pops.push({ x: r.x, y: r.y, t: 0 });
              blip(opts.sound, 1046);
            } else blip(opts.sound, 660);
          }
        }
      // Caillou contre fusée.
      if (s.inv > 0) s.inv -= dt;
      for (const r of rocks) {
        if (r.hp > 0 && s.inv <= 0 && Math.abs(r.x - s.x) < r.r + 26 && Math.abs(r.y - (SHIP_Y - 20)) < r.r + 34) {
          r.hp = 0;
          pops.push({ x: r.x, y: r.y, t: 0 });
          if (shield) shield = false;
          else s.lives--;
          s.inv = 1.4;
          navigator.vibrate?.(80);
        }
      }
      rocks = rocks.filter((r) => r.hp > 0 && r.y < H + 60);
      for (const p of pops) p.t += dt;
      pops = pops.filter((p) => p.t < 0.5);
      return s.lives <= 0;
    },

    draw(t) {
      const sky = x.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1B1840');
      sky.addColorStop(1, '#3B2C6E');
      x.fillStyle = sky;
      x.fillRect(0, 0, W, H);
      x.fillStyle = '#fff';
      for (const st of stars) {
        x.globalAlpha = 0.4 + st.r / 4;
        x.beginPath();
        x.arc(st.x, st.y, st.r, 0, 7);
        x.fill();
      }
      x.globalAlpha = 1;
      // Une petite planète au loin.
      x.fillStyle = '#FF9D3C';
      x.beginPath();
      x.arc(690, 120, 34, 0, 7);
      x.fill();
      x.strokeStyle = '#FFC22E';
      x.lineWidth = 5;
      x.beginPath();
      x.ellipse(690, 120, 56, 12, -0.3, 0, 7);
      x.stroke();

      for (const sh of shots) {
        x.fillStyle = '#FFE27A';
        x.beginPath();
        x.ellipse(sh.x, sh.y, 5, 10, 0, 0, 7);
        x.fill();
        x.fillStyle = 'rgba(255,226,122,.35)';
        x.beginPath();
        x.ellipse(sh.x, sh.y + 12, 4, 10, 0, 0, 7);
        x.fill();
      }
      for (const r of rocks) {
        x.save();
        x.translate(r.x, r.y);
        x.rotate(r.rot);
        x.fillStyle = r.hp > 1 ? '#8B7FA8' : '#A99CC4';
        x.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const rr = r.r * (0.82 + ((i * 37) % 10) / 50);
          x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        x.closePath();
        x.fill();
        x.fillStyle = 'rgba(43,33,64,.25)';
        x.beginPath();
        x.arc(-r.r / 3, -r.r / 4, r.r / 4, 0, 7);
        x.arc(r.r / 3, r.r / 3, r.r / 5, 0, 7);
        x.fill();
        x.restore();
      }
      for (const p of pops) {
        x.strokeStyle = `rgba(255,226,122,${1 - p.t * 2})`;
        x.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r0 = 10 + p.t * 80;
          x.beginPath();
          x.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
          x.lineTo(p.x + Math.cos(a) * (r0 + 12), p.y + Math.sin(a) * (r0 + 12));
          x.stroke();
        }
      }

      // La fusée-gland, avec Pico dans le hublot.
      if (!(s.inv > 0 && Math.floor(s.inv * 10) % 2)) {
        x.save();
        x.translate(s.x, SHIP_Y);
        x.rotate(s.tilt);
        const flame = 14 + Math.sin(t * 40) * 5;
        x.fillStyle = '#FF9D3C';
        x.beginPath();
        x.moveTo(-14, 30);
        x.lineTo(0, 30 + flame + 14);
        x.lineTo(14, 30);
        x.fill();
        x.fillStyle = '#FFE27A';
        x.beginPath();
        x.moveTo(-7, 30);
        x.lineTo(0, 30 + flame);
        x.lineTo(7, 30);
        x.fill();
        x.fillStyle = '#B5672F';
        x.beginPath();
        x.ellipse(0, 0, 34, 40, 0, 0, 7);
        x.fill();
        x.fillStyle = '#6E4125';
        x.beginPath();
        x.ellipse(0, -34, 38, 18, 0, 0, 7);
        x.fill();
        x.fillRect(-3, -58, 6, 10);
        x.fillStyle = '#3E8E5E';
        x.beginPath();
        x.moveTo(-34, 10);
        x.lineTo(-50, 36);
        x.lineTo(-24, 28);
        x.moveTo(34, 10);
        x.lineTo(50, 36);
        x.lineTo(24, 28);
        x.fill();
        x.fillStyle = '#DDF1FF';
        x.beginPath();
        x.arc(0, 4, 22, 0, 7);
        x.fill();
        if (img.complete) x.drawImage(img, -26, -22, 52, 52);
        x.strokeStyle = '#6E4125';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(0, 4, 22, 0, 7);
        x.stroke();
        x.restore();
      }
      if (comp) {
        // Toujours sur le côté de la fusée (jamais devant Pico), du côté où il y a de la place.
        const side = s.x > W / 2 ? -1 : 1;
        compX += (s.x + side * 100 - compX) * 0.08;
        if (Math.abs(compX - s.x) < 90) compX = s.x + (compX < s.x ? -90 : 90);
        drawCompanion(x, comp, Math.max(45, Math.min(W - 45, compX)), SHIP_Y - 20, 84, t);
        if (shield) drawShield(x, s.x, SHIP_Y - 4, 60, t);
      }
      hud(x, { lives: s.lives, t, duration: dur, score: '💥 ' + s.score, hint: 'Glisse ton doigt pour piloter !', dark: true });
      if (comp && shield) {
        x.font = '800 26px "Baloo 2", sans-serif';
        x.textAlign = 'left';
        x.fillText('🛡️', 130, 34);
      }
    },

    result: (t) => ({ score: s.score, lives: Math.max(0, s.lives), seconds: Math.round(t) }),
  }));
};
