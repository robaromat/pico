import { signal } from '@preact/signals';

// Demandes globales affichées par App : le pavé du code parent et les petits messages.

export interface CodeAsk {
  title: string;
  sub?: string;
  resolve: (ok: boolean) => void;
}
export const codeAsk = signal<CodeAsk | null>(null);

/** Demande le code parent ; true s'il est bon, false si on annule. */
export function askCode(title: string, sub?: string): Promise<boolean> {
  return new Promise((resolve) => {
    codeAsk.value = {
      title,
      sub,
      resolve: (ok) => {
        codeAsk.value = null;
        resolve(ok);
      },
    };
  });
}

export const toastMsg = signal<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string): void {
  toastMsg.value = msg;
  clearTimeout(timer);
  timer = setTimeout(() => (toastMsg.value = null), 2800);
}
