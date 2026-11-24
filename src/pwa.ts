import { signal } from '@preact/signals';

// Mises à jour de l'app (repris de Boire & Manger).

/** Une nouvelle version est téléchargée et attend d'être activée. */
export const updateReady = signal(false);
/** Android/Chrome : on peut proposer « Installer l'app » (événement beforeinstallprompt). */
export const installPrompt = signal<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

let registration: ServiceWorkerRegistration | null = null;

export function setupPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as unknown as NonNullable<typeof installPrompt.value>;
  });
  window.addEventListener('appinstalled', () => (installPrompt.value = null));

  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const base = import.meta.env.BASE_URL;
  void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).then((reg) => {
    registration = reg;
    const watch = (w: ServiceWorker | null) => {
      if (!w) return;
      w.addEventListener('statechange', () => {
        // « installed » alors qu'une version tourne déjà = mise à jour prête.
        if (w.state === 'installed' && navigator.serviceWorker.controller) updateReady.value = true;
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) updateReady.value = true;
    reg.addEventListener('updatefound', () => watch(reg.installing));
    // Vérifie s'il y a une nouvelle version à chaque retour sur l'app.
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update());
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !updateReady.value) return;
    reloading = true;
    location.reload();
  });

  // Demande au navigateur de ne pas effacer le cache local de lui-même (stockage « persistant »).
  void navigator.storage?.persist?.();
}

export function applyUpdate(): void {
  const w = registration?.waiting;
  if (w) w.postMessage('SKIP_WAITING');
  else location.reload();
}
