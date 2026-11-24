import { useEffect, useRef, useState } from 'preact/hooks';
import { runCourse, type CourseResult } from '../../game/course';
import type { Child } from '../../model/types';
import { chime } from '../../ui/fx';
import { Pico } from '../../ui/Pico';

// Écran du jeu : passe la tablette en paysage plein écran, lance la course, affiche le score 5 s
// puis revient tout seul à l'accueil. Pas de bouton « Rejouer » (une partie = une mission réussie).

async function enterLandscape(): Promise<void> {
  const b = window.PicoAndroid;
  if (b) return b.setLandscape(true);
  try {
    await document.documentElement.requestFullscreen?.();
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
  } catch {
    /* le navigateur refuse : on demandera de tourner la tablette */
  }
}

async function leaveLandscape(): Promise<void> {
  const b = window.PicoAndroid;
  if (b) return b.setLandscape(false);
  try {
    screen.orientation?.unlock?.();
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* rien */
  }
}

const isPortrait = () => innerHeight > innerWidth;

export function Game({ child, sound, onEnd, onExit }: { child: Child; sound: boolean; onEnd: (r: CourseResult) => void; onExit: () => void }) {
  const [phase, setPhase] = useState<'rotate' | 'play' | 'end'>('rotate');
  const [result, setResult] = useState<CourseResult | null>(null);
  const [left, setLeft] = useState(5);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bestBefore = useRef(child.best).current;

  // Passe en paysage, et démarre dès que l'écran est tourné.
  useEffect(() => {
    void enterLandscape();
    const check = () => phase === 'rotate' && !isPortrait() && setPhase('play');
    const t = setTimeout(check, 400);
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', check);
    };
  }, [phase]);

  useEffect(() => () => void leaveLandscape(), []);

  useEffect(() => {
    if (phase !== 'play' || !canvas.current) return;
    const run = runCourse(canvas.current, { scarf: child.scarf, level: child.level, sound });
    void run.done.then((r) => {
      setResult(r);
      onEnd(r);
      chime(sound);
      setTimeout(() => setPhase('end'), 350);
    });
    return run.stop;
  }, [phase === 'play']);

  useEffect(() => {
    if (phase !== 'end') return;
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'end' && left <= 0) onExit();
  }, [left, phase]);

  if (phase === 'rotate')
    return (
      <div class="rotate">
        <Pico expr="hello" scarf={child.scarf} cls="turn" />
        <h2>Tourne la tablette 🔄</h2>
        <button class="kbtn big" onClick={() => setPhase('play')}>
          C'est fait !
        </button>
      </div>
    );

  const record = result && result.score > bestBefore;
  return (
    <div class="game">
      <div class="game-box">
        <canvas ref={canvas} aria-label="Jeu : touche l'écran pour sauter" />
      </div>
      {phase === 'end' && result && (
        <div class="gend">
          <Pico expr="happy" scarf={child.scarf} cls="roll" />
          <div>
            <h2>Bravo !</h2>
            <p>
              {result.score} 🍎 ramassée{result.score > 1 ? 's' : ''}
              {record ? ' · nouveau record !' : ''}
            </p>
            <p class="small">Meilleur score : {Math.max(child.best, result.score)} 🍎</p>
            <small>Retour à l'accueil dans {Math.max(0, left)}…</small>
          </div>
        </div>
      )}
    </div>
  );
}
