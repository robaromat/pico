import { useEffect, useRef, useState } from 'preact/hooks';
import { SCARVES } from '../../model/defaults';
import { addEvent, declare, finishPlay, startPlay, updateChild } from '../../model/ops';
import { balance, earnedPoints, nowState, treasures, type MissionView, type NowState } from '../../model/rules';
import { CREATURES, type Creature } from '../../creatures';
import { Collection, markCreaturesSeen, newCreatures, NewCreature } from './Collection';
import { dayLabel, hourLabel } from '../../model/time';
import type { Child, PicoFile, Reward } from '../../model/types';
import { data, engine, mutate } from '../../sync/store';
import { askCode, toast } from '../../ui/ask';
import { blip, chime, confetti } from '../../ui/fx';
import { Pico } from '../../ui/Pico';
import { useNow } from '../../ui/useNow';
import { markSeen, pendingCelebrations, type Celebration } from './celebrations';
import { Game } from './Game';

// La tablette de l'enfant : Pico, la tirelire, les missions du moment, le bouton Jouer, la boutique et les trésors.

type Tab = 'missions' | 'shop' | 'collection' | 'treasures';

export function KidApp({ onParent }: { onParent: () => void }) {
  const f = data.value!;
  const child = f.children[0]!;
  const now = useNow();
  const st = nowState(f, child, now);
  const [tab, setTab] = useState<Tab>('missions');
  const [playing, setPlaying] = useState(false);
  const [party, setParty] = useState<Celebration | null>(null);
  const [bought, setBought] = useState<Reward | null>(null);
  const [crea, setCrea] = useState<Creature[] | null>(null);
  const sound = f.settings.sound;
  const earned = earnedPoints(f, child.id);

  // Fêtes à montrer (validations et surprises arrivées depuis un téléphone).
  useEffect(() => {
    if (playing || party || bought || st.night) return;
    const next = pendingCelebrations(f, child.id)[0];
    if (next) return setParty(next);
    // Après la fête des points : la nouvelle créature débloquée.
    if (crea) return;
    const fresh = newCreatures(earned);
    if (fresh.length) setCrea(fresh);
  }, [f, playing, party, bought, crea, st.night]);

  async function parentMode() {
    if (await askCode('Mode parent')) onParent();
  }

  if (!child.introDone) return <Intro child={child} />;

  if (playing)
    return (
      <Game
        child={child}
        sound={sound}
        onStart={(g) => mutate((x) => startPlay(x, child.id, g))}
        onEnd={(g, r) => mutate((x) => finishPlay(x, child.id, g, r.score, r.lives, r.seconds))}
        onExit={() => {
          setPlaying(false);
          setTab('missions');
        }}
      />
    );

  if (st.night) return <Night child={child} f={f} onParent={() => void parentMode()} />;

  return (
    <div class="kid">
      <header class="k-head">
        <button class="lock" aria-label="Mode parent" onClick={() => void parentMode()}>
          🔒
        </button>
        <Pico expr={bubbleMood(st)} scarf={child.scarf} cls="bob" />
        <div class="bubble">{bubbleText(child, st, now)}</div>
        <div class="piggy" aria-label={`${st.balance} bons points`}>
          <b>{st.balance}</b>
          <span>⭐ points</span>
        </div>
        <SyncDot />
      </header>

      <main class="k-body">
        {tab === 'missions' && <Missions f={f} child={child} st={st} sound={sound} onPlay={() => setPlaying(true)} />}
        {tab === 'shop' && <Shop f={f} child={child} st={st} onBought={setBought} sound={sound} />}
        {tab === 'collection' && <Collection earned={earned} child={child} />}
        {tab === 'treasures' && <Treasures f={f} child={child} />}
      </main>

      <nav class="k-tabs">
        <TabBtn tab="missions" cur={tab} set={setTab} icon="⭐" label="Missions" />
        <TabBtn tab="shop" cur={tab} set={setTab} icon="🛍️" label="Boutique" />
        <TabBtn tab="collection" cur={tab} set={setTab} icon="🐾" label="Collection" />
        <TabBtn tab="treasures" cur={tab} set={setTab} icon="🎁" label="Mes trésors" />
      </nav>

      {party && (
        <Party
          child={child}
          sound={sound}
          expr={party.kind === 'surprise' ? 'gift' : 'happy'}
          onClose={() => {
            markSeen(party.ids);
            setParty(null);
          }}
        >
          {party.kind === 'validate' ? (
            <>
              <h2>Bravo !</h2>
              <p>{party.titles.length === 1 ? `« ${party.titles[0]} » : c'est validé !` : `${party.titles.length} missions validées !`}</p>
              <p class="big">
                +{party.points} ⭐{party.games ? ` et ${party.games} partie${party.games > 1 ? 's' : ''} 🎮` : ''}
              </p>
            </>
          ) : (
            <>
              <h2>Surprise !</h2>
              <p>Papa ou Maman a remarqué que {party.text} 💛</p>
              <p class="big">+{party.points} ⭐</p>
            </>
          )}
        </Party>
      )}
      {crea && !party && (
        <NewCreature
          list={crea}
          sound={sound}
          onClose={() => {
            markCreaturesSeen(CREATURES.indexOf(crea.at(-1)!) + 1);
            setCrea(null);
            setTab('collection');
          }}
        />
      )}
      {bought && (
        <Party child={child} sound={sound} expr="gift" onClose={() => setBought(null)}>
          <h2>C'est à toi !</h2>
          <p>
            {bought.emoji} {bought.title}
          </p>
          <p class="small">Retrouve-le dans « Mes trésors ».</p>
        </Party>
      )}
    </div>
  );
}

function bubbleMood(st: NowState) {
  if (st.visible.some((v) => v.status === 'pending')) return 'wait' as const;
  if (st.visible.length && st.visible.every((v) => v.status === 'done')) return 'happy' as const;
  return 'hello' as const;
}

function bubbleText(child: Child, st: NowState, now: Date): string {
  if (st.pause) return `Aujourd'hui, c'est une journée tranquille, ${child.name} !`;
  if (st.special && st.period === 'nuit') return `Soirée spéciale jusqu'à ${hourLabel(st.special)} ! 🌙`;
  if (st.visible.some((v) => v.status === 'pending')) return "Bravo ! J'attends que Papa ou Maman vérifie.";
  if (st.visible.length && st.visible.every((v) => v.status === 'done')) return 'Tout est fait pour ce moment ! 🎉';
  if (!st.visible.length) return `Rien à faire pour l'instant, ${child.name}.`;
  const h = now.getHours();
  return h < 12 ? `Bonjour ${child.name} ! Prêt pour tes défis ?` : h < 18 ? `Coucou ${child.name} ! On y va ?` : `Bonsoir ${child.name} ! Encore un petit effort ?`;
}

function SyncDot() {
  const s = engine.value?.status.value;
  if (s === 'syncing') return <span class="syncpill">↻</span>;
  if (s === 'offline') return <span class="syncpill off" title="Pas de réseau">📡</span>;
  return null;
}

function TabBtn({ tab, cur, set, icon, label }: { tab: Tab; cur: Tab; set: (t: Tab) => void; icon: string; label: string }) {
  return (
    <button aria-pressed={tab === cur} onClick={() => set(tab)}>
      <span>{icon}</span>
      {label}
    </button>
  );
}

// ---------- Missions ----------
function Missions({ f, child, st, sound, onPlay }: { f: PicoFile; child: Child; st: NowState; sound: boolean; onPlay: () => void }) {
  const dream = f.rewards.find((r) => r.id === child.dreamId && r.active && !r.deleted);
  return (
    <>
      {st.pause ? (
        <div class="alldone">🌈 Journée pause : profite bien !</div>
      ) : (
        <>
          <h2 class="k-title">Mes missions</h2>
          {st.visible.length === 0 && <div class="alldone">Pas de mission pour ce moment. 😊</div>}
          {st.visible.map((v) => (
            <MissionCard key={v.mission.id} v={v} onDone={() => {
              blip(sound);
              mutate((x) => declare(x, child.id, v.mission.id));
            }} />
          ))}
        </>
      )}
      <button class={`play${st.games ? ' on' : ''}`} disabled={!st.games} onClick={onPlay}>
        {st.games ? `🎮 Jouer · ${st.games} partie${st.games > 1 ? 's' : ''} !` : '🎮 Réussis une mission pour jouer !'}
      </button>
      {dream && <Dream reward={dream} points={st.balance} />}
    </>
  );
}

function MissionCard({ v, onDone }: { v: MissionView; onDone: () => void }) {
  const m = v.mission;
  return (
    <div class={`mcard s-${v.status}`}>
      <span class="memo" aria-hidden="true">
        {m.emoji}
      </span>
      <div class="mtxt">
        <b>{m.title}</b>
        <span>
          {m.points} ⭐{m.givesGame ? ' + 🎮' : ''}
          {m.oneOff ? ' · défi du jour' : ''}
        </span>
      </div>
      {v.status === 'todo' && (
        <button class="kbtn" onClick={onDone}>
          J'ai fini !
        </button>
      )}
      {v.status === 'pending' && <span class="wait">⏳ Papa ou Maman vérifie</span>}
      {v.status === 'done' && <span class="ok">✅ Bravo !</span>}
    </div>
  );
}

function Dream({ reward, points }: { reward: Reward; points: number }) {
  const pct = Math.min(100, Math.round((points / reward.price) * 100));
  const left = reward.price - points;
  return (
    <div class="dream">
      <span class="de">{reward.emoji}</span>
      <div class="dt">
        <b>Mon rêve : {reward.title}</b>
        <div class="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <small>{left > 0 ? `Encore ${left} ⭐` : 'Tu as assez de points ! 🎉'}</small>
      </div>
    </div>
  );
}

// ---------- Boutique ----------
function Shop({ f, child, st, onBought, sound }: { f: PicoFile; child: Child; st: NowState; onBought: (r: Reward) => void; sound: boolean }) {
  const rewards = f.rewards.filter((r) => r.active && !r.deleted).sort((a, b) => a.price - b.price);

  async function want(r: Reward) {
    if (!(await askCode(`Offrir : ${r.title}`, `−${r.price} ⭐`))) return;
    const latest = data.value;
    if (!latest || balance(latest, child) < r.price) return toast("Il n'y a plus assez de points.");
    mutate((x) => addEvent(x, child.id, { type: 'purchase', rewardId: r.id, title: r.title, emoji: r.emoji, price: r.price }));
    chime(sound);
    onBought(r);
  }

  return (
    <>
      <h2 class="k-title">La boutique</h2>
      <p class="k-hint">Touche l'étoile pour choisir ton rêve.</p>
      <div class="shop">
        {rewards.map((r) => {
          const ok = st.balance >= r.price;
          const dreamed = child.dreamId === r.id;
          return (
            <div key={r.id} class={`rw${dreamed ? ' dreamed' : ''}`}>
              <button
                class="pin"
                aria-pressed={dreamed}
                aria-label={dreamed ? 'Ne plus en faire mon rêve' : 'En faire mon rêve'}
                onClick={() => mutate((x) => updateChild(x, child.id, { dreamId: dreamed ? null : r.id }))}
              >
                ⭐
              </button>
              <span class="re">{r.emoji}</span>
              <b>{r.title}</b>
              <span class="price">{r.price} ⭐</span>
              <button class="kbtn" disabled={!ok} onClick={() => void want(r)}>
                {ok ? 'Je veux ça !' : `Encore ${r.price - st.balance} ⭐`}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Treasures({ f, child }: { f: PicoFile; child: Child }) {
  const list = treasures(f, child.id);
  return (
    <>
      <h2 class="k-title">Mes trésors</h2>
      {!list.length && <div class="alldone">Pas encore de trésor. Ils arriveront ici ! ✨</div>}
      {list.map((t) => (
        <div key={t.id} class="tre">
          <span class="re">{t.emoji}</span>
          <div>
            <b>{t.title}</b>
            <small>{dayLabel(t.day)}</small>
          </div>
        </div>
      ))}
    </>
  );
}

// ---------- Fête ----------
function Party({ child, sound, expr, onClose, children }: { child: Child; sound: boolean; expr: 'happy' | 'gift'; onClose: () => void; children: preact.ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) confetti(box.current);
    chime(sound);
  }, []);
  return (
    <div class="celebrate" ref={box} role="dialog" aria-live="polite">
      <Pico expr={expr} scarf={child.scarf} cls={expr === 'happy' ? 'roll' : 'bob'} />
      {children}
      <button class="kbtn big" onClick={onClose}>
        Super !
      </button>
    </div>
  );
}

// ---------- Nuit ----------
function Night({ child, f, onParent }: { child: Child; f: PicoFile; onParent: () => void }) {
  const stars = useRef(Array.from({ length: 24 }, () => ({ l: Math.random() * 100, t: Math.random() * 60, d: Math.random() * 2.4 }))).current;
  return (
    <div class="night">
      {stars.map((s, i) => (
        <i key={i} class="star" style={{ left: `${s.l}%`, top: `${s.t}%`, animationDelay: `${s.d}s` }} />
      ))}
      <button class="lock" aria-label="Mode parent" onClick={onParent}>
        🔒
      </button>
      <Pico expr="sleep" scarf={child.scarf} />
      <h2>Chut… Pico dort.</h2>
      <p>Il est l'heure de dormir, {child.name}. À demain !</p>
      <p class="small">Tes points t'attendent : {balance(f, child)} ⭐</p>
    </div>
  );
}

// ---------- Intro ----------
function Intro({ child }: { child: Child }) {
  const [step, setStep] = useState(0);
  const [scarf, setScarf] = useState(child.scarf);
  const done = () => mutate((x) => updateChild(x, child.id, { introDone: true, scarf }));
  const pages = [
    <>
      <h2>Salut {child.name} ! Moi, c'est Pico.</h2>
      <p>Je suis un hérisson et j'habite dans la forêt.</p>
    </>,
    <>
      <h2>Choisis la couleur de mon écharpe !</h2>
      <div class="sw">
        {SCARVES.map((c) => (
          <button key={c} style={{ background: c }} aria-pressed={c === scarf} aria-label="Couleur" onClick={() => setScarf(c)} />
        ))}
      </div>
    </>,
    <>
      <h2>Comment ça marche ?</h2>
      <p>Quand tu as fini une mission, appuie sur « J'ai fini ! ».</p>
      <p>Papa ou Maman vérifie, et tu gagnes des ⭐ et parfois une partie de jeu !</p>
    </>,
  ];
  return (
    <div class="intro">
      <Pico expr={step === 1 ? 'happy' : 'hello'} scarf={scarf} cls="bob" />
      {pages[step]}
      <div class="dots">
        {pages.map((_, i) => (
          <i key={i} class={i === step ? 'on' : ''} />
        ))}
      </div>
      <button class="kbtn big" onClick={() => (step < pages.length - 1 ? setStep(step + 1) : done())}>
        {step < pages.length - 1 ? 'Suivant' : "C'est parti !"}
      </button>
    </div>
  );
}
