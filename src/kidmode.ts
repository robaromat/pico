import { signal } from '@preact/signals';

// « Prêter le téléphone » : un téléphone parent peut passer en mode enfant (sans code),
// et n'en sort qu'avec le code parent (cadenas). Le choix survit à un rechargement de l'appli,
// pour qu'un enfant ne puisse pas revenir au mode parent en fermant et rouvrant l'appli.

const KEY = 'pico-kid-mode';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const kidMode = signal(read());

export function setKidMode(on: boolean): void {
  kidMode.value = on;
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
}
