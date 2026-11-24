// Petits effets : son doux (trois notes) et confettis.

let actx: AudioContext | null = null;

export function chime(enabled = true): void {
  if (!enabled) return;
  try {
    actx ??= new AudioContext();
    const t = actx.currentTime;
    for (const [f, d] of [
      [659, 0],
      [880, 0.12],
      [1047, 0.24],
    ] as const) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.linearRampToValueAtTime(0.14, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.5);
      o.connect(g).connect(actx.destination);
      o.start(t + d);
      o.stop(t + d + 0.55);
    }
  } catch {
    /* pas de son */
  }
}

/** Petit « pop » pour les boutons et le jeu. */
export function blip(enabled = true, freq = 880): void {
  if (!enabled) return;
  try {
    actx ??= new AudioContext();
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.08);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + 0.16);
  } catch {
    /* pas de son */
  }
}

export function confetti(host: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  host.appendChild(c);
  const r = host.getBoundingClientRect();
  c.width = r.width;
  c.height = r.height;
  const x = c.getContext('2d');
  if (!x) return;
  const cols = ['#FFC22E', '#E8475B', '#2FA56A', '#3C93E8', '#FF8434', '#8A5CF5'];
  const ps = Array.from({ length: 110 }, () => ({
    x: r.width / 2,
    y: r.height * 0.38,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 10 - 3,
    s: Math.random() * 7 + 5,
    c: cols[(Math.random() * 6) | 0]!,
    a: Math.random() * 6,
  }));
  const t0 = performance.now();
  const f = (t: number) => {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.vy += 0.28;
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.2;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.a);
      x.fillStyle = p.c;
      x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      x.restore();
    }
    if (t - t0 < 2400) requestAnimationFrame(f);
    else c.remove();
  };
  requestAnimationFrame(f);
}
