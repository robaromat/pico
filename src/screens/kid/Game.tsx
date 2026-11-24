import { useEffect, useRef, useState } from 'preact/hooks';
import { runCourse } from '../../game/course';
import { runEspace } from '../../game/espace';
import type { GameResult, GameRunner } from '../../game/kit';
import { runVerger } from '../../game/verger';
import { bestOf } from '../../model/ops';
import type { Child, GameId } from '../../model/types';
import { chime } from '../../ui/fx';
import { Pico } from '../../ui/Pico';

// Écran du jeu : l'enfant choisit son jeu, la tablette passe en paysage plein écran, la partie se joue,
// le score reste affiché 5 s puis retour tout seul à l'accueil. Pas de bouton « Rejouer » (une partie = une mission réussie).
// La partie n'est consommée qu'au moment où le jeu est choisi (revenir depuis le choix ne coûte rien).

interface GameDef {
  id: GameId;
  title: string;
  hint: string;
  emoji: string;
  unit: string;
  run: GameRunner;
}

export const GAMES: GameDef[] = [
  { id: 'course', title: 'La course', hint: 'Touche pour sauter', emoji: '🌳', unit: '🍎', run: runCourse },
  { id: 'verger', title: 'Le verger', hint: 'Attrape les pommes', emoji: '🧺', unit: '🍎', run: runVerger },
  { id: 'espace', title: 'Les étoiles', hint: 'Pulvérise les cailloux', emoji: '🚀', unit: '💥', run: runEspace },
];

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

export function Game({
  child,
  sound,
  onStart,
  onEnd,
  onExit,
}: {
  child: Child;
  sound: boolean;
  onStart: (g: GameId) => void;
  onEnd: (g: GameId, r: GameResult) => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<'choose' | 'rotate' | 'play' | 'end'>('choose');
  const [game, setGame] = useState<GameDef>(GAMES[0]!);
  const [result, setResult] = useState<GameResult | null>(null);
  const [left, setLeft] = useState(5);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bestBefore = useRef(0);

  function choose(g: GameDef) {
    bestBefore.current = bestOf(child, g.id);
    setGame(g);
    onStart(g.id);
    setPhase('rotate');
  }

  // Passe en paysage, et démarre dès que l'écran est tourné.
  useEffect(() => {
    if (phase === 'choose') return;
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
    const run = game.run(canvas.current, { scarf: child.scarf, level: child.level, sound });
    void run.done.then((r) => {
      setResult(r);
      onEnd(game.id, r);
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

  if (phase === 'choose')
    return (
      <div class="choose">
        <h2>À quoi on joue ?</h2>
        <div class="choose-list">
          {GAMES.map((g) => (
            <button key={g.id} class={`gcard g-${g.id}`} onClick={() => choose(g)}>
              <span class="gcard-emoji">{g.emoji}</span>
              <b>{g.title}</b>
              <small>{g.hint}</small>
              {bestOf(child, g.id) > 0 && (
                <em>
                  Record : {bestOf(child, g.id)} {g.unit}
                </em>
              )}
            </button>
          ))}
        </div>
        <button class="linkbtn" onClick={onExit}>
          ← Retour
        </button>
      </div>
    );

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

  const record = result && result.score > bestBefore.current && bestBefore.current > 0;
  return (
    <div class="game">
      <div class="game-box">
        <canvas ref={canvas} aria-label={`Jeu : ${game.title}, ${game.hint.toLowerCase()}`} />
      </div>
      {phase === 'end' && result && (
        <div class="gend">
          <Pico expr="happy" scarf={child.scarf} cls="roll" />
          <div>
            <h2>Bravo !</h2>
            <p>
              {result.score} {game.unit}
              {record ? ' · nouveau record !' : ''}
            </p>
            <p class="small">
              Meilleur score : {Math.max(bestBefore.current, result.score)} {game.unit}
            </p>
            <small>Retour à l'accueil dans {Math.max(0, left)}…</small>
          </div>
        </div>
      )}
    </div>
  );
}
