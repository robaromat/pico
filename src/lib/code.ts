// Code parent à 4 chiffres : seul son empreinte (PBKDF2-SHA256 + sel) est rangée dans les données.
// Il est redemandé à chaque action parent ; 3 erreurs bloquent le pavé 1 minute (par appareil).

const ITERATIONS = 120_000;

const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashCode(code: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS },
    key,
    256,
  );
  return hex(bits);
}

export async function checkCode(code: string, salt: string, hash: string): Promise<boolean> {
  return (await hashCode(code, salt)) === hash;
}

const LOCK_KEY = 'pico-code-lock';
interface LockState {
  fails: number;
  until: number;
}

function readLock(): LockState {
  try {
    return { fails: 0, until: 0, ...JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}') };
  } catch {
    return { fails: 0, until: 0 };
  }
}
function writeLock(s: LockState) {
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(s));
  } catch {
    /* rien */
  }
}

/** Millisecondes restantes de blocage (0 = pas bloqué). */
export function lockRemaining(now = Date.now()): number {
  return Math.max(0, readLock().until - now);
}

/** Enregistre un essai ; renvoie true si le pavé vient d'être bloqué. */
export function registerAttempt(ok: boolean, now = Date.now()): boolean {
  if (ok) {
    writeLock({ fails: 0, until: 0 });
    return false;
  }
  const s = readLock();
  const fails = s.fails + 1;
  if (fails >= 3) {
    writeLock({ fails: 0, until: now + 60_000 });
    return true;
  }
  writeLock({ fails, until: s.until });
  return false;
}
