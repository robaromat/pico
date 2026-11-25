import { useEffect, useRef, useState } from 'preact/hooks';
import { CREATURES, creatureSvg, nextForm, pointsToNext, POINTS_PER_CREATURE, previousForm, TYPE_INFO, unlockedCount, type Creature } from '../../creatures';
import { chime, confetti } from '../../ui/fx';
import { updateChild } from '../../model/ops';
import type { Child } from '../../model/types';
import { mutate } from '../../sync/store';

// Onglet « Ma collection » : les créatures débloquées (1 tous les 10 bons points gagnés),
// la prochaine en silhouette avec sa jauge, et la fiche de chaque créature (type, PV, attaque, évolution).

function Art({ c, cls = '' }: { c: Creature; cls?: string }) {
  return <span class={`crea-wrap ${cls}`} dangerouslySetInnerHTML={{ __html: creatureSvg(c) }} />;
}

export function Collection({ earned, child }: { earned: number; child: Child }) {
  const n = unlockedCount(earned);
  const left = pointsToNext(earned);
  const next = CREATURES[n];
  const [open, setOpen] = useState<Creature | null>(null);
  return (
    <>
      <h2 class="k-title">
        Ma collection · {n} / {CREATURES.length}
      </h2>
      {next && left !== null && (
        <div class="crea-next">
          <Art c={next} cls="sil" />
          <div class="grow">
            <b>Prochaine créature</b>
            <div class="gauge">
              <i style={{ width: `${((POINTS_PER_CREATURE - left) / POINTS_PER_CREATURE) * 100}%` }} />
            </div>
            <small>
              Encore {left} ⭐ à gagner{previousForm(next) && n > 0 ? ` · une évolution de ${previousForm(next)!.name} !` : ''}
            </small>
          </div>
        </div>
      )}
      {!next && <div class="alldone">Bravo, tu as toutes les créatures ! 🏆</div>}
      {n > 0 && !child.companion && <p class="k-hint">Touche une créature pour en faire ton compagnon de jeu 🛡️</p>}
      <div class="crea-grid">
        {CREATURES.map((c, i) =>
          i < n ? (
            <button key={c.id} class={`crea-card t-${c.type}${child.companion === c.id ? ' comp' : ''}`} onClick={() => setOpen(c)}>
              {child.companion === c.id && <span class="comp-tag">🛡️ Compagnon</span>}
              <Art c={c} />
              <b>{c.name}</b>
              <small>
                {TYPE_INFO[c.type].emoji} {TYPE_INFO[c.type].label}
              </small>
            </button>
          ) : (
            <div key={c.id} class="crea-card locked" aria-label="Créature à découvrir">
              <Art c={c} cls="sil" />
              <b>?</b>
              <small>{(i + 1) * POINTS_PER_CREATURE} ⭐</small>
            </div>
          ),
        )}
      </div>
      {open && <Sheet c={open} child={child} owned={(x) => CREATURES.indexOf(x) < n} onClose={() => setOpen(null)} />}
    </>
  );
}

function Sheet({ c, child, owned, onClose }: { c: Creature; child: Child; owned: (c: Creature) => boolean; onClose: () => void }) {
  const isComp = child.companion === c.id;
  const t = TYPE_INFO[c.type];
  const prev = previousForm(c);
  const next = nextForm(c);
  return (
    <div class="crea-sheet" role="dialog" aria-label={c.name} onClick={onClose}>
      <div class={`crea-fiche t-${c.type}`} onClick={(e) => e.stopPropagation()}>
        <div class="fiche-top">
          <b>{c.name}</b>
          <span class="badge" style={{ background: t.color }}>
            {t.emoji} {t.label}
          </span>
        </div>
        <Art c={c} cls="big" />
        <div class="stats">
          <div>
            <small>Points de vie</small>
            <b>❤️ {c.hp}</b>
          </div>
          <div>
            <small>Attaque</small>
            <b>💥 {c.atk}</b>
          </div>
        </div>
        <p class="atk">
          Attaque spéciale : <b>{c.attack}</b>
        </p>
        <p class="small">
          {'★'.repeat(c.stage)}
          {'☆'.repeat(4 - c.stage)} · stade {c.stage}
          {prev ? ` · évolution de ${prev.name}` : ''}
        </p>
        {next && <p class="small">{owned(next) ? `Évolue en ${next.name} ✔` : 'Évolue en… ? (continue tes missions !)'}</p>}
        <div class="row">
          {isComp ? (
            <span class="comp-on">🛡️ C'est ton compagnon de jeu</span>
          ) : (
            <button
              class="kbtn"
              onClick={() => {
                mutate((f) => updateChild(f, child.id, { companion: c.id }));
                onClose();
              }}
            >
              🛡️ Mon compagnon
            </button>
          )}
          <button class="kbtn ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
        <p class="small">Ton compagnon te suit dans les jeux et te protège une fois par partie.</p>
      </div>
    </div>
  );
}

// ---------- Fête « nouvelle créature » ----------

const SEEN_KEY = 'pico-crea-seen';

function readSeen(): number | null {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export function markCreaturesSeen(n: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(n));
  } catch {
    /* rien */
  }
}

/** Créatures débloquées mais pas encore fêtées sur cet appareil (au premier lancement : aucune). */
export function newCreatures(earned: number): Creature[] {
  const n = unlockedCount(earned);
  const seen = readSeen();
  if (seen === null) {
    markCreaturesSeen(n);
    return [];
  }
  return CREATURES.slice(Math.min(seen, n), n);
}

export function NewCreature({ list, sound, onClose }: { list: Creature[]; sound: boolean; onClose: () => void }) {
  const c = list.at(-1)!;
  const prev = previousForm(c);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (box.current) confetti(box.current);
    chime(sound);
  }, []);
  return (
    <div class="celebrate" ref={box} role="dialog" aria-live="polite">
      <Art c={c} cls="big pop" />
      <h2>{prev ? `${prev.name} évolue !` : 'Nouvelle créature !'}</h2>
      <p class="big">
        {c.name} {TYPE_INFO[c.type].emoji}
      </p>
      <p>
        ❤️ {c.hp} · 💥 {c.atk} · {c.attack}
      </p>
      {list.length > 1 && <p class="small">et {list.length - 1} autre{list.length > 2 ? 's' : ''} dans ta collection !</p>}
      <button class="kbtn big" onClick={onClose}>
        Génial !
      </button>
    </div>
  );
}
