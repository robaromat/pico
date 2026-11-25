import { useState } from 'preact/hooks';
import { DEFI_TEMPLATES, MISSION_EMOJIS } from '../../model/defaults';
import { addEvent, decide, decideAll, upsertMission } from '../../model/ops';
import {
  balance,
  childEvents,
  gamesLeft,
  isPause,
  lastDays,
  missionRates,
  missionStatuses,
  nowState,
  pendingDeclarations,
  pointsOn,
  specialPlanned,
} from '../../model/rules';
import { dayKey, dayLabel, hourLabel, MOMENT_LABEL, WEEKDAYS_SHORT } from '../../model/time';
import type { Child, PicoEvent, PicoFile } from '../../model/types';
import { newId } from '../../lib/ids';
import { data, engine, mutate } from '../../sync/store';
import { askCode, toast } from '../../ui/ask';
import { Chips, Sheet, Toggle } from '../../ui/Sheet';
import { useNow } from '../../ui/useNow';
import { Settings } from './Settings';
import { Tuto, tutoSeen } from './Tuto';
import { setKidMode } from '../../kidmode';
import { markOldSeen } from '../kid/celebrations';

// Téléphone parent : tableau de bord en lecture, et chaque action protégée par le code (redemandé à chaque fois).

type SheetKind = 'defi' | 'surprise' | 'reward' | 'special' | 'correct' | null;

export function ParentApp({ onTablet, onBack }: { onTablet: boolean; onBack: () => void }) {
  const f = data.value!;
  const child = f.children[0]!;
  const now = useNow();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [settings, setSettings] = useState(false);
  // Le tuto s'affiche la première fois sur un téléphone (pas en mode parent sur la tablette).
  const [tuto, setTuto] = useState(() => !onTablet && !tutoSeen());

  async function openSettings() {
    if (await askCode('Réglages')) setSettings(true);
  }

  if (settings)
    return (
      <Settings
        onClose={() => setSettings(false)}
        onTuto={() => {
          setSettings(false);
          setTuto(true);
        }}
      />
    );

  const today = dayKey(now);
  const pause = isPause(f, child.id, today);
  const special = specialPlanned(f, child.id, today);

  async function togglePause() {
    const ok = await askCode(pause ? 'Reprendre les missions' : 'Journée pause', pause ? undefined : "Les missions sont masquées aujourd'hui. Rien n'est compté, rien n'est perdu.");
    if (!ok) return;
    mutate((x) => addEvent(x, child.id, { type: 'pause', on: !pause }));
    toast(pause ? 'Missions de retour' : 'Journée pause activée');
  }

  async function endSpecial() {
    if (!(await askCode('Finir la soirée spéciale', 'Pico retourne se coucher.'))) return;
    mutate((x) => addEvent(x, child.id, { type: 'special', on: false, until: '00:00' }));
    toast('Soirée spéciale terminée');
  }

  return (
    <div class="par">
      <header class="p-head">
        <h1>
          Pico · {child.name}
          <small>{dayLabel(today)}</small>
        </h1>
        <SyncBadge />
        <button class="icon-btn" aria-label="Réglages" onClick={() => void openSettings()}>
          ⚙︎
        </button>
      </header>
      {onTablet ? (
        <button class="pbtn acc back-kid" onClick={onBack}>
          ← Retour au mode enfant
        </button>
      ) : (
        <button
          class="pbtn back-kid"
          onClick={() => {
            markOldSeen(f, child.id);
            setKidMode(true);
          }}
        >
          🦔 Prêter le téléphone à {child.name}
        </button>
      )}

      <main class="p-body">
        <Pending f={f} child={child} now={now} />
        <Today f={f} child={child} now={now} pause={pause} special={special?.until ?? null} />
        <Piggy f={f} child={child} />

        <section class="p-sec">
          <h3>Actions</h3>
          <div class="qa">
            <button onClick={() => setSheet('defi')}>
              <span>➕</span>Défi du jour
            </button>
            <button onClick={() => setSheet('surprise')}>
              <span>🎁</span>Bon point surprise
            </button>
            <button onClick={() => setSheet('reward')}>
              <span>🛍️</span>Offrir une récompense
            </button>
            <button onClick={() => (special ? void endSpecial() : setSheet('special'))}>
              <span>🌙</span>
              {special ? 'Finir la soirée' : 'Soirée spéciale'}
            </button>
            <button onClick={() => void togglePause()}>
              <span>{pause ? '▶️' : '🌈'}</span>
              {pause ? 'Reprendre' : 'Journée pause'}
            </button>
            <button onClick={() => setSheet('correct')}>
              <span>✏️</span>Corriger
            </button>
          </div>
        </section>

        <Week f={f} child={child} now={now} />
        <Journal f={f} child={child} />
      </main>

      {sheet === 'defi' && <DefiSheet child={child} onClose={() => setSheet(null)} />}
      {sheet === 'surprise' && <SurpriseSheet child={child} onClose={() => setSheet(null)} />}
      {sheet === 'reward' && <RewardSheet f={f} child={child} onClose={() => setSheet(null)} />}
      {sheet === 'special' && <SpecialSheet child={child} onClose={() => setSheet(null)} />}
      {sheet === 'correct' && <CorrectSheet f={f} child={child} onClose={() => setSheet(null)} />}
      {tuto && <Tuto name={child.name} onClose={() => setTuto(false)} />}
    </div>
  );
}

function SyncBadge() {
  const e = engine.value;
  const s = e?.status.value;
  const label = s === 'syncing' || s === 'loading' ? '↻' : s === 'pending' ? '⏳' : s === 'offline' ? '📡' : s === 'error' ? '⚠️' : '✓';
  const title =
    s === 'offline' ? 'Hors connexion : sera envoyé au retour du réseau' : s === 'error' ? e?.error.value ?? 'Erreur' : s === 'pending' ? 'Envoi en attente' : 'À jour';
  return (
    <button class={`icon-btn sync-${s}`} title={title} aria-label={`Synchroniser (${title})`} onClick={() => void e?.sync()}>
      {label}
    </button>
  );
}

// ---------- En attente ----------
function Pending({ f, child, now }: { f: PicoFile; child: Child; now: Date }) {
  const list = pendingDeclarations(f, child.id);
  const today = dayKey(now);

  async function one(id: string, ok: boolean, title: string) {
    if (!(await askCode(ok ? 'Valider' : 'Pas encore', title))) return;
    mutate((x) => decide(x, id, ok));
    toast(ok ? 'Validé : la tablette va fêter ça' : 'Noté, sans rien enlever');
  }

  async function all() {
    if (!(await askCode('Tout valider', `${list.length} mission${list.length > 1 ? 's' : ''}`))) return;
    mutate((x) => decideAll(x, list.map((p) => p.declare.id)));
    toast('Tout est validé');
  }

  return (
    <section class="p-sec">
      <h3>
        En attente {list.length > 0 && <span class="badge">{list.length}</span>}
      </h3>
      {!list.length && <p class="empty">Rien à valider pour l'instant.</p>}
      {list.map(({ declare: d, mission: m }) => (
        <div key={d.id} class="pend">
          <span class="e">{m?.emoji ?? '❔'}</span>
          <div class="t">
            <b>{m?.title ?? 'Mission supprimée'}</b>
            <small>
              {d.day === today ? `à ${new Date(d.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : `${dayLabel(d.day)} · points seulement`} · {m?.points ?? 1} ⭐
              {m?.givesGame && d.day === today ? ' + 🎮' : ''}
            </small>
          </div>
          <button class="pbtn" onClick={() => void one(d.id, false, m?.title ?? '')}>
            Pas encore
          </button>
          <button class="pbtn ok" onClick={() => void one(d.id, true, m?.title ?? '')}>
            Bravo ✓
          </button>
        </div>
      ))}
      {list.length > 1 && (
        <button class="pbtn ok wide" onClick={() => void all()}>
          Tout valider ({list.length})
        </button>
      )}
    </section>
  );
}

// ---------- Aujourd'hui ----------
function Today({ f, child, now, pause, special }: { f: PicoFile; child: Child; now: Date; pause: boolean; special: string | null }) {
  const today = dayKey(now);
  const st = nowState(f, child, now);
  const statuses = missionStatuses(f, child.id, now);
  const played = childEvents(f, child.id).filter((e) => e.type === 'play' && e.day === today).length;
  const cur = st.period === 'nuit' ? null : st.period;
  return (
    <section class="p-sec">
      <h3>Aujourd'hui</h3>
      {pause && <p class="banner-p">🌈 Journée pause : rien n'est compté aujourd'hui.</p>}
      {special && <p class="banner-p">🌙 Soirée spéciale jusqu'à {hourLabel(special)}.</p>}
      <div class="kpis">
        <div class="kpi">
          <b>{pointsOn(f, child.id, today)} ⭐</b>
          <small>gagnés aujourd'hui</small>
        </div>
        <div class="kpi">
          <b>{gamesLeft(f, child.id, today)}</b>
          <small>
            partie{st.games > 1 ? 's' : ''} à jouer · {played} jouée{played > 1 ? 's' : ''}
          </small>
        </div>
      </div>
      {(['jour', 'matin', 'aprem', 'soir'] as const).map((mo) => {
        const list = statuses.filter((v) => v.mission.moment === mo);
        if (!list.length) return null;
        return (
          <div key={mo}>
            <div class={`mm${mo === cur ? ' cur' : ''}`}>
              {MOMENT_LABEL[mo]}
              {mo === cur ? ' · maintenant' : ''}
            </div>
            {list.map((v) => (
              <div key={v.mission.id} class="mrow">
                <span>{v.mission.emoji}</span>
                <span>{v.mission.title}</span>
                <span class="st">{v.status === 'done' ? '✅' : v.status === 'pending' ? '⏳' : '·'}</span>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function Piggy({ f, child }: { f: PicoFile; child: Child }) {
  const b = balance(f, child);
  const dream = f.rewards.find((r) => r.id === child.dreamId && !r.deleted);
  return (
    <section class="p-sec">
      <h3>Tirelire</h3>
      <div class="kpis">
        <div class="kpi">
          <b>{b} ⭐</b>
          <small>à dépenser</small>
        </div>
        <div class="kpi">
          <b>{dream ? `${dream.emoji} ${Math.min(100, Math.round((b / dream.price) * 100))} %` : '—'}</b>
          <small>{dream ? `rêve : ${dream.title} (${dream.price} ⭐)` : 'pas de rêve épinglé'}</small>
        </div>
      </div>
    </section>
  );
}

// ---------- Semaine ----------
function Week({ f, child, now }: { f: PicoFile; child: Child; now: Date }) {
  const days = lastDays(f, child.id, now);
  const max = Math.max(5, ...days.map((d) => d.points));
  const rates = missionRates(f, child.id, now).filter((r) => r.planned > 0);
  const total = days.reduce((n, d) => n + d.points, 0);
  return (
    <section class="p-sec">
      <h3>7 derniers jours · {total} ⭐</h3>
      <div class="week">
        {days.map((d, i) => {
          const [y, m, dd] = d.key.split('-').map(Number);
          const wd = new Date(y!, m! - 1, dd!).getDay();
          return (
            <div key={d.key} class={i === days.length - 1 ? 'today' : ''}>
              <em>{d.points}</em>
              <i style={{ height: `${(d.points / max) * 70 + 3}%` }} />
              <small>{WEEKDAYS_SHORT[wd]}</small>
            </div>
          );
        })}
      </div>
      {rates.length > 0 && (
        <div class="rates">
          {rates.map((r) => (
            <div key={r.mission.id}>
              <span>
                {r.mission.emoji} {r.mission.title} <small>({MOMENT_LABEL[r.mission.moment].toLowerCase()})</small>
              </span>
              <b>
                {r.validated}/{r.planned}
              </b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const EVENT_TEXT: Partial<Record<PicoEvent['type'], (e: PicoEvent, f: PicoFile) => string>> = {
  declare: (e, f) => `« J'ai fini » : ${f.missions.find((m) => e.type === 'declare' && m.id === e.missionId)?.title ?? '?'}`,
  validate: (e, f) => (e.type === 'validate' ? `Validé : ${f.missions.find((m) => m.id === e.missionId)?.title ?? '?'} (+${e.points} ⭐)` : ''),
  refuse: () => 'Pas encore',
  surprise: (e) => (e.type === 'surprise' ? `Surprise +${e.points} ⭐ : ${e.text}` : ''),
  purchase: (e) => (e.type === 'purchase' ? `${e.emoji} ${e.title} (−${e.price} ⭐)` : ''),
  correct: (e) => (e.type === 'correct' ? `Correction ${e.delta > 0 ? '+' : ''}${e.delta} ⭐ : ${e.note}` : ''),
  play: () => '🎮 Partie jouée',
  pause: (e) => (e.type === 'pause' ? (e.on ? '🌈 Journée pause' : 'Fin de la journée pause') : ''),
  special: (e) => (e.type === 'special' ? (e.on ? `🌙 Soirée spéciale jusqu'à ${hourLabel(e.until)}` : 'Fin de la soirée spéciale') : ''),
};

function Journal({ f, child }: { f: PicoFile; child: Child }) {
  const [n, setN] = useState(8);
  const evs = childEvents(f, child.id).reverse();
  return (
    <section class="p-sec">
      <h3>Journal</h3>
      {!evs.length && <p class="empty">Rien pour l'instant.</p>}
      {evs.slice(0, n).map((e) => (
        <div key={e.id} class="jrow">
          <small>
            {new Date(e.at).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
          </small>
          <span>{EVENT_TEXT[e.type]?.(e, f)}</span>
        </div>
      ))}
      {evs.length > n && (
        <button class="pbtn wide" onClick={() => setN(n + 20)}>
          Voir plus
        </button>
      )}
    </section>
  );
}

// ---------- Panneaux d'action ----------
function DefiSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const f = data.value!;
  // Modèles : les défis prêts à l'emploi, puis les derniers défis déjà donnés (sans doublon).
  const templates: [string, string, number][] = [...DEFI_TEMPLATES];
  for (const m of [...f.missions].filter((m) => m.oneOff && m.childId === child.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)))
    if (templates.length < 6 && !templates.some((t) => t[1] === m.title)) templates.push([m.emoji, m.title, m.points]);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [points, setPoints] = useState(1);
  const [game, setGame] = useState(true);
  async function go() {
    if (!title.trim()) return;
    if (!(await askCode('Ajouter le défi', `${emoji} ${title.trim()}`))) return;
    const now = new Date();
    mutate((x) =>
      upsertMission(x, {
        id: newId('d'),
        childId: child.id,
        title: title.trim(),
        emoji,
        points,
        givesGame: game,
        moment: 'jour',
        days: [now.getDay()],
        active: true,
        oneOff: true,
        date: dayKey(now),
        updatedAt: now.toISOString(),
      }),
    );
    toast('Défi ajouté pour aujourd\'hui');
    onClose();
  }
  return (
    <Sheet label="Défi du jour" onClose={onClose}>
      <h3>➕ Défi pour aujourd'hui</h3>
      <div class="tpl">
        {templates.map(([e, t, p]) => (
          <button
            key={t}
            type="button"
            aria-pressed={title === t}
            onClick={() => {
              setTitle(t);
              setEmoji(e);
              setPoints(p);
            }}
          >
            {e} {t}
          </button>
        ))}
      </div>
      <label>
        Le défi (positif et concret)
        <input type="text" value={title} placeholder="Dire bonjour à Mamie avec le sourire" onInput={(e) => setTitle(e.currentTarget.value)} />
      </label>
      <label>
        Image
        <Chips values={MISSION_EMOJIS} value={emoji} onChange={setEmoji} />
      </label>
      <label>
        Points
        <Chips values={[1, 2, 3, 4, 5]} value={points} onChange={setPoints} />
      </label>
      <div class="set-i">
        <span class="grow">Donne une partie de jeu</span>
        <Toggle on={game} onChange={setGame} label="Donne une partie" />
      </div>
      <p class="empty">Visible toute la journée sur la tablette, jusqu'à l'heure du coucher.</p>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" disabled={!title.trim()} onClick={() => void go()}>
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}

function SurpriseSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const [points, setPoints] = useState(1);
  const [text, setText] = useState('');
  async function go() {
    if (!text.trim()) return;
    if (!(await askCode('Envoyer le bon point', `+${points} ⭐ : ${text.trim()}`))) return;
    mutate((x) => addEvent(x, child.id, { type: 'surprise', points, text: text.trim() }));
    toast('Bon point envoyé');
    onClose();
  }
  return (
    <Sheet label="Bon point surprise" onClose={onClose}>
      <h3>🎁 Bon point surprise</h3>
      <p class="empty">Pour un bon geste fait sans qu'on le demande. Des points seulement, pas de partie.</p>
      <label>
        Combien ?
        <Chips values={[1, 2, 3]} value={points} onChange={setPoints} label={(n) => `${n} ⭐`} />
      </label>
      <label>
        Ce qu'il a fait (obligatoire, lu sur la tablette)
        <div class="tpl">
          {['tu as fait un acte de gentillesse'].map((t) => (
            <button key={t} type="button" aria-pressed={text === t} onClick={() => setText(t)}>
              {t}
            </button>
          ))}
        </div>
        <input type="text" value={text} placeholder="tu as aidé ton frère à ranger" onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      <p class="empty">La tablette affichera : « Papa ou Maman a remarqué que {text.trim() || '…'} 💛 »</p>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" disabled={!text.trim()} onClick={() => void go()}>
          Envoyer
        </button>
      </div>
    </Sheet>
  );
}

function RewardSheet({ f, child, onClose }: { f: PicoFile; child: Child; onClose: () => void }) {
  const b = balance(f, child);
  const rewards = f.rewards.filter((r) => r.active && !r.deleted).sort((a, c) => a.price - c.price);
  async function give(id: string) {
    const r = rewards.find((x) => x.id === id)!;
    if (!(await askCode(`Offrir : ${r.title}`, `−${r.price} ⭐`))) return;
    mutate((x) => addEvent(x, child.id, { type: 'purchase', rewardId: r.id, title: r.title, emoji: r.emoji, price: r.price }));
    toast('Récompense offerte');
    onClose();
  }
  return (
    <Sheet label="Offrir une récompense" onClose={onClose}>
      <h3>🛍️ Offrir une récompense</h3>
      <p class="empty">Tirelire : {b} ⭐</p>
      {rewards.map((r) => (
        <div key={r.id} class="set-i">
          <span class="e">{r.emoji}</span>
          <span class="grow">
            {r.title}
            <br />
            <small>{r.price} ⭐</small>
          </span>
          <button class={`pbtn ${b >= r.price ? 'acc' : ''}`} disabled={b < r.price} onClick={() => void give(r.id)}>
            Offrir
          </button>
        </div>
      ))}
      <button class="pbtn wide" onClick={onClose}>
        Fermer
      </button>
    </Sheet>
  );
}

function SpecialSheet({ child, onClose }: { child: Child; onClose: () => void }) {
  const [until, setUntil] = useState('22:00');
  async function go() {
    if (!(await askCode('Soirée spéciale', `Jusqu'à ${hourLabel(until)}`))) return;
    mutate((x) => addEvent(x, child.id, { type: 'special', on: true, until }));
    toast('Soirée spéciale activée');
    onClose();
  }
  return (
    <Sheet label="Soirée spéciale" onClose={onClose}>
      <h3>🌙 Soirée spéciale</h3>
      <p class="empty">Pico ne s'endort pas avant l'heure choisie : les parties restent jouables. Tout redevient normal demain.</p>
      <label>
        Jusqu'à
        <Chips values={['21:00', '21:30', '22:00', '22:30', '23:00']} value={until} onChange={setUntil} label={hourLabel} />
      </label>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" onClick={() => void go()}>
          Activer
        </button>
      </div>
    </Sheet>
  );
}

function CorrectSheet({ f, child, onClose }: { f: PicoFile; child: Child; onClose: () => void }) {
  const [delta, setDelta] = useState(0);
  const [note, setNote] = useState('');
  const b = balance(f, child);
  async function go() {
    if (!delta || !note.trim()) return;
    if (!(await askCode('Corriger', `${delta > 0 ? '+' : ''}${delta} ⭐`))) return;
    mutate((x) => addEvent(x, child.id, { type: 'correct', delta, note: note.trim() }));
    toast('Correction enregistrée');
    onClose();
  }
  return (
    <Sheet label="Corriger les points" onClose={onClose}>
      <h3>✏️ Corriger les points</h3>
      <p class="empty">Pour réparer une erreur de saisie. Discret : rien ne s'affiche sur la tablette. Jamais pour punir.</p>
      <div class="row center">
        <button class="pbtn" onClick={() => setDelta(Math.max(-b, delta - 1))}>
          −1
        </button>
        <b class="delta">{delta > 0 ? `+${delta}` : delta}</b>
        <button class="pbtn" onClick={() => setDelta(delta + 1)}>
          +1
        </button>
      </div>
      <label>
        Note (pour vous)
        <input type="text" value={note} placeholder="mission validée deux fois" onInput={(e) => setNote(e.currentTarget.value)} />
      </label>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" disabled={!delta || !note.trim()} onClick={() => void go()}>
          Corriger
        </button>
      </div>
    </Sheet>
  );
}
