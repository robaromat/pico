import qrcode from 'qrcode-generator';
import { useEffect, useState } from 'preact/hooks';
import { device, encodeSetup, saveDevice, type Role } from '../../device';
import { hashCode, newSalt } from '../../lib/code';
import { newId } from '../../lib/ids';
import { MISSION_EMOJIS, REWARD_EMOJIS } from '../../model/defaults';
import { updateChild, updateSettings, upsertMission, upsertReward } from '../../model/ops';
import { MAX_VISIBLE } from '../../model/rules';
import { hourLabel, MOMENT_LABEL, WEEKDAYS_SHORT } from '../../model/time';
import type { Mission, MissionMoment, Reward, Schedule } from '../../model/types';
import { data, mutate, resetLocal } from '../../sync/store';
import { toast } from '../../ui/ask';
import { Chips, Sheet, Toggle } from '../../ui/Sheet';

// Réglages (derrière le code, redemandé à chaque ouverture) : missions, boutique, horaires, général, appareils.

const MOMENTS: MissionMoment[] = ['matin', 'aprem', 'soir'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function Settings({ onClose }: { onClose: () => void }) {
  const f = data.value!;
  const child = f.children[0]!;
  const [mission, setMission] = useState<Mission | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  const [qr, setQr] = useState(false);
  const [code, setCode] = useState(false);
  const [hours, setHours] = useState(false);

  const recurring = f.missions.filter((m) => m.childId === child.id && !m.oneOff && !m.deleted);
  const activeCount = (mo: MissionMoment) => recurring.filter((m) => m.active && m.moment === mo).length;

  function toggleMission(m: Mission) {
    if (!m.active && activeCount(m.moment) >= MAX_VISIBLE) return toast(`${MAX_VISIBLE} missions au maximum par moment`);
    mutate((x) => upsertMission(x, { ...m, active: !m.active }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data.value, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pico-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function disconnect() {
    if (!confirm('Déconnecter cet appareil ? Il faudra le réinstaller avec un QR code.')) return;
    await resetLocal();
    saveDevice(null);
  }

  const s = f.settings;
  return (
    <div class="par">
      <header class="p-head">
        <h1>Réglages</h1>
        <button class="pbtn acc" onClick={onClose}>
          Fermer
        </button>
      </header>
      <main class="p-body">
        <section class="p-sec">
          <h3>Missions de tous les jours</h3>
          <p class="empty">{MAX_VISIBLE} au maximum par moment. Touche une mission pour la modifier.</p>
          {MOMENTS.map((mo) => (
            <div key={mo} class="set-g">
              <div class="mm">
                {MOMENT_LABEL[mo]} · {activeCount(mo)}/{MAX_VISIBLE}
              </div>
              {recurring
                .filter((m) => m.moment === mo)
                .map((m) => (
                  <div key={m.id} class="set-i">
                    <button class="set-edit" onClick={() => setMission(m)}>
                      <span class="e">{m.emoji}</span>
                      <span class="grow">
                        {m.title}
                        <br />
                        <small>
                          {m.points} ⭐ · {m.givesGame ? 'donne une partie' : 'pas de partie'} · {daysLabel(m.days)}
                        </small>
                      </span>
                    </button>
                    <Toggle on={m.active} onChange={() => toggleMission(m)} label={`Activer ${m.title}`} />
                  </div>
                ))}
            </div>
          ))}
          <button
            class="pbtn wide"
            onClick={() =>
              setMission({ id: newId('m'), childId: child.id, title: '', emoji: '⭐', points: 1, givesGame: true, moment: 'aprem', days: [0, 1, 2, 3, 4, 5, 6], active: false, updatedAt: '' })
            }
          >
            ➕ Nouvelle mission
          </button>
        </section>

        <section class="p-sec">
          <h3>Boutique</h3>
          {f.rewards
            .filter((r) => !r.deleted)
            .sort((a, b) => a.price - b.price)
            .map((r) => (
              <div key={r.id} class="set-i">
                <button class="set-edit" onClick={() => setReward(r)}>
                  <span class="e">{r.emoji}</span>
                  <span class="grow">
                    {r.title}
                    <br />
                    <small>{r.price} ⭐</small>
                  </span>
                </button>
                <Toggle on={r.active} onChange={(v) => mutate((x) => upsertReward(x, { ...r, active: v }))} label={`Afficher ${r.title}`} />
              </div>
            ))}
          <button class="pbtn wide" onClick={() => setReward({ id: newId('r'), title: '', emoji: '🎁', price: 10, active: true, updatedAt: '' })}>
            ➕ Nouvelle récompense
          </button>
        </section>

        <section class="p-sec">
          <h3>Horaires</h3>
          <button class="set-i set-edit" onClick={() => setHours(true)}>
            <span class="grow">
              Coucher {hourLabel(s.bedtime)} · réveil {hourLabel(s.wakeup)}
              <br />
              <small>
                École : matin → {hourLabel(s.school.matin)}, après-midi → {hourLabel(s.school.aprem)} · Sans école ({daysLabel(s.freeDays)}) : matin →{' '}
                {hourLabel(s.free.matin)}, après-midi → {hourLabel(s.free.aprem)}
              </small>
            </span>
            <span>›</span>
          </button>
        </section>

        <section class="p-sec">
          <h3>Général</h3>
          <label class="set-i">
            <span class="grow">Prénom affiché</span>
            <input class="inline" value={child.name} onChange={(e) => e.currentTarget.value.trim() && mutate((x) => updateChild(x, child.id, { name: e.currentTarget.value.trim() }))} />
          </label>
          <label class="set-i">
            <span class="grow">
              Bons points de départ
              <br />
              <small>Ajoutés au total, une seule fois</small>
            </span>
            <input
              class="inline num"
              inputMode="numeric"
              value={child.startPoints}
              onChange={(e) => {
                const n = Number(e.currentTarget.value.replace(/\D/g, ''));
                if (Number.isFinite(n)) mutate((x) => updateChild(x, child.id, { startPoints: n }));
              }}
            />
          </label>
          <div class="set-i">
            <span class="grow">Sons sur la tablette</span>
            <Toggle on={s.sound} onChange={(v) => mutate((x) => updateSettings(x, { sound: v }))} label="Sons" />
          </div>
          <div class="set-i">
            <span class="grow">Code parent</span>
            <button class="pbtn" onClick={() => setCode(true)}>
              Changer
            </button>
          </div>
          <div class="set-i">
            <span class="grow">Revoir l'intro de Pico sur la tablette</span>
            <button
              class="pbtn"
              onClick={() => {
                mutate((x) => updateChild(x, child.id, { introDone: false }));
                toast("L'intro s'affichera sur la tablette");
              }}
            >
              Relancer
            </button>
          </div>
        </section>

        <section class="p-sec">
          <h3>Appareils et sauvegarde</h3>
          <div class="set-i">
            <span class="grow">Ajouter un appareil</span>
            <button class="pbtn acc" onClick={() => setQr(true)}>
              QR code
            </button>
          </div>
          <div class="set-i">
            <span class="grow">
              Sauvegarde
              <br />
              <small>L'historique complet est aussi gardé par GitHub</small>
            </span>
            <button class="pbtn" onClick={exportJson}>
              Exporter (JSON)
            </button>
          </div>
          <div class="set-i">
            <span class="grow">
              Cet appareil : {device.value?.role === 'child' ? 'tablette enfant' : 'téléphone parent'}
              <br />
              <small>Pico {__APP_VERSION__}</small>
            </span>
            <button class="pbtn" onClick={() => void disconnect()}>
              Déconnecter
            </button>
          </div>
        </section>
        <p class="empty center">En quittant les réglages, le code sera redemandé la prochaine fois.</p>
      </main>

      {mission && <MissionSheet m={mission} activeCount={activeCount} onClose={() => setMission(null)} />}
      {reward && <RewardEdit r={reward} onClose={() => setReward(null)} />}
      {qr && <AddDevice onClose={() => setQr(false)} />}
      {code && <ChangeCode onClose={() => setCode(false)} />}
      {hours && <Hours onClose={() => setHours(false)} />}
    </div>
  );
}

function daysLabel(days: number[]): string {
  if (days.length === 7) return 'tous les jours';
  return WEEK_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAYS_SHORT[d])
    .join(' ');
}

function DaysPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  return (
    <div class="chips">
      {WEEK_ORDER.map((d) => (
        <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>
          {WEEKDAYS_SHORT[d]}
        </button>
      ))}
    </div>
  );
}

function MissionSheet({ m, activeCount, onClose }: { m: Mission; activeCount: (mo: MissionMoment) => number; onClose: () => void }) {
  const [x, setX] = useState(m);
  const isNew = !m.updatedAt;
  function save() {
    if (!x.title.trim() || !x.days.length) return;
    const movingIn = x.active && (x.moment !== m.moment || !m.active);
    if (movingIn && activeCount(x.moment) >= MAX_VISIBLE) return toast(`Déjà ${MAX_VISIBLE} missions actives le ${MOMENT_LABEL[x.moment].toLowerCase()}`);
    mutate((f) => upsertMission(f, { ...x, title: x.title.trim() }));
    onClose();
  }
  return (
    <Sheet label="Mission" onClose={onClose}>
      <h3>{isNew ? 'Nouvelle mission' : 'Modifier la mission'}</h3>
      <label>
        Intitulé (positif et concret)
        <input type="text" value={x.title} onInput={(e) => setX({ ...x, title: e.currentTarget.value })} />
      </label>
      <label>
        Image
        <Chips values={MISSION_EMOJIS} value={x.emoji} onChange={(emoji) => setX({ ...x, emoji })} />
      </label>
      <label>
        Moment
        <Chips values={MOMENTS} value={x.moment} onChange={(moment) => setX({ ...x, moment, givesGame: moment === 'soir' ? false : x.givesGame })} label={(v) => MOMENT_LABEL[v]} />
      </label>
      <label>
        Jours
        <DaysPicker days={x.days} onChange={(days) => setX({ ...x, days })} />
      </label>
      <label>
        Points
        <Chips values={[1, 2, 3, 4, 5]} value={x.points} onChange={(points) => setX({ ...x, points })} />
      </label>
      <div class="set-i">
        <span class="grow">
          Donne une partie de jeu
          {x.moment === 'soir' && (
            <>
              <br />
              <small>Le soir, la partie risque d'être perdue au coucher</small>
            </>
          )}
        </span>
        <Toggle on={x.givesGame} onChange={(givesGame) => setX({ ...x, givesGame })} label="Donne une partie" />
      </div>
      <div class="set-i">
        <span class="grow">Active</span>
        <Toggle on={x.active} onChange={(active) => setX({ ...x, active })} label="Active" />
      </div>
      <div class="row">
        {!isNew && (
          <button
            class="pbtn danger"
            onClick={() => {
              if (!confirm(`Supprimer « ${m.title} » ? L'historique est gardé.`)) return;
              mutate((f) => upsertMission(f, { ...m, deleted: true, active: false }));
              onClose();
            }}
          >
            Supprimer
          </button>
        )}
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" disabled={!x.title.trim() || !x.days.length} onClick={save}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function RewardEdit({ r, onClose }: { r: Reward; onClose: () => void }) {
  const [x, setX] = useState(r);
  const isNew = !r.updatedAt;
  return (
    <Sheet label="Récompense" onClose={onClose}>
      <h3>{isNew ? 'Nouvelle récompense' : 'Modifier la récompense'}</h3>
      <label>
        Intitulé
        <input type="text" value={x.title} onInput={(e) => setX({ ...x, title: e.currentTarget.value })} />
      </label>
      <label>
        Image
        <Chips values={REWARD_EMOJIS} value={x.emoji} onChange={(emoji) => setX({ ...x, emoji })} />
      </label>
      <label>
        Prix en bons points
        <input type="text" inputMode="numeric" value={x.price} onInput={(e) => setX({ ...x, price: Number(e.currentTarget.value.replace(/\D/g, '')) || 0 })} />
      </label>
      <div class="row">
        {!isNew && (
          <button
            class="pbtn danger"
            onClick={() => {
              if (!confirm(`Supprimer « ${r.title} » ?`)) return;
              mutate((f) => upsertReward(f, { ...r, deleted: true, active: false }));
              onClose();
            }}
          >
            Supprimer
          </button>
        )}
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button
          class="pbtn acc"
          disabled={!x.title.trim() || x.price < 1}
          onClick={() => {
            mutate((f) => upsertReward(f, { ...x, title: x.title.trim() }));
            onClose();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function Hours({ onClose }: { onClose: () => void }) {
  const s = data.value!.settings;
  const [x, setX] = useState({ bedtime: s.bedtime, wakeup: s.wakeup, school: s.school, free: s.free, freeDays: s.freeDays });
  const sched = (k: 'school' | 'free', v: Partial<Schedule>) => setX({ ...x, [k]: { ...x[k], ...v } });
  return (
    <Sheet label="Horaires" onClose={onClose}>
      <h3>Horaires</h3>
      <div class="grid2">
        <label>
          Coucher (Pico dort)
          <input type="time" value={x.bedtime} onInput={(e) => setX({ ...x, bedtime: e.currentTarget.value })} />
        </label>
        <label>
          Réveil
          <input type="time" value={x.wakeup} onInput={(e) => setX({ ...x, wakeup: e.currentTarget.value })} />
        </label>
      </div>
      <h4>Jours d'école</h4>
      <div class="grid2">
        <label>
          Fin du matin
          <input type="time" value={x.school.matin} onInput={(e) => sched('school', { matin: e.currentTarget.value })} />
        </label>
        <label>
          Fin de l'après-midi
          <input type="time" value={x.school.aprem} onInput={(e) => sched('school', { aprem: e.currentTarget.value })} />
        </label>
      </div>
      <h4>Jours sans école</h4>
      <DaysPicker days={x.freeDays} onChange={(freeDays) => setX({ ...x, freeDays })} />
      <div class="grid2">
        <label>
          Fin du matin
          <input type="time" value={x.free.matin} onInput={(e) => sched('free', { matin: e.currentTarget.value })} />
        </label>
        <label>
          Fin de l'après-midi
          <input type="time" value={x.free.aprem} onInput={(e) => sched('free', { aprem: e.currentTarget.value })} />
        </label>
      </div>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button
          class="pbtn acc"
          onClick={() => {
            mutate((f) => updateSettings(f, x));
            onClose();
          }}
        >
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function ChangeCode({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const ok = /^\d{4}$/.test(a) && a === b;
  async function save() {
    const salt = newSalt();
    const hash = await hashCode(a, salt);
    mutate((f) => updateSettings(f, { codeHash: hash, codeSalt: salt }));
    toast('Nouveau code enregistré');
    onClose();
  }
  return (
    <Sheet label="Changer le code" onClose={onClose}>
      <h3>Nouveau code parent</h3>
      <label>
        4 chiffres
        <input type="password" inputMode="numeric" maxLength={4} value={a} onInput={(e) => setA(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      <label>
        Encore une fois
        <input type="password" inputMode="numeric" maxLength={4} value={b} onInput={(e) => setB(e.currentTarget.value.replace(/\D/g, ''))} />
      </label>
      <div class="row">
        <button class="pbtn" onClick={onClose}>
          Annuler
        </button>
        <button class="pbtn acc" disabled={!ok} onClick={() => void save()}>
          Enregistrer
        </button>
      </div>
    </Sheet>
  );
}

function AddDevice({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<Role>('child');
  const [left, setLeft] = useState(60);
  const d = device.value!;
  const q = qrcode(0, 'M');
  q.addData(encodeSetup({ ...d, role }));
  q.make();
  const svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });

  useEffect(() => {
    const t = setInterval(() => setLeft((n) => n - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) onClose();
  }, [left]);

  return (
    <Sheet label="Ajouter un appareil" onClose={onClose}>
      <h3>Ajouter un appareil</h3>
      <label>
        Rôle du nouvel appareil
        <Chips<Role> values={['child', 'parent']} value={role} onChange={setRole} label={(r) => (r === 'child' ? 'Tablette enfant' : 'Téléphone parent')} />
      </label>
      <div class="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <b class="center">Disparaît dans {left} s</b>
      <p class="empty">Sur le nouvel appareil : ouvrir Pico → « Scanner le QR code ». Ce code contient l'accès aux données : ne le montre à personne d'autre.</p>
      <button class="pbtn wide" onClick={onClose}>
        Fermer
      </button>
    </Sheet>
  );
}
