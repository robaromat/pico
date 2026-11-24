import { useEffect, useState } from 'preact/hooks';
import { checkCode, lockRemaining, registerAttempt } from '../lib/code';
import { data } from '../sync/store';

/**
 * Pavé du code parent. Le code n'est jamais retenu : il est redemandé à chaque action.
 * 3 erreurs = pavé bloqué 1 minute sur cet appareil.
 */
export function CodePad({ title, sub, onOk, onCancel }: { title: string; sub?: string; onOk: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const locked = lockRemaining();

  useEffect(() => {
    if (!locked) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [locked > 0]);

  async function press(k: string) {
    if (busy || lockRemaining()) return;
    if (k === 'b') return setCode(code.slice(0, -1));
    const next = (code + k).slice(0, 4);
    setCode(next);
    if (next.length < 4) return;
    const s = data.value?.settings;
    if (!s) return;
    setBusy(true);
    const ok = await checkCode(next, s.codeSalt, s.codeHash);
    setBusy(false);
    const blocked = registerAttempt(ok);
    if (ok) return onOk();
    setCode('');
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setErr(blocked ? '' : "Ce n'est pas le bon code.");
  }

  const msg = locked ? `Trop d'essais. Réessaie dans ${Math.ceil(locked / 1000)} s.` : busy ? 'Vérification…' : err;
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div class={`pad${shake ? ' shake' : ''}`} role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {sub && <p class="sub">{sub}</p>}
        <div class="pdots" aria-label={`${code.length} chiffres sur 4`}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} class={i < code.length ? 'on' : ''} />
          ))}
        </div>
        <div class="err" role="status">
          {msg}
        </div>
        <div class="keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button key={n} disabled={!!locked} onClick={() => void press(n)}>
              {n}
            </button>
          ))}
          <button class="txt" onClick={onCancel}>
            Annuler
          </button>
          <button disabled={!!locked} onClick={() => void press('0')}>
            0
          </button>
          <button class="txt" aria-label="Effacer" onClick={() => void press('b')}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
