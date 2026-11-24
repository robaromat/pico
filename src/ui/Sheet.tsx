import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

/** Panneau qui monte du bas de l'écran (côté parent). Échap ou toucher le fond le ferme. */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ComponentChildren }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/** Rangée de choix (puces). */
export function Chips<T extends string | number>({ values, value, onChange, label }: { values: readonly T[]; value: T; onChange: (v: T) => void; label?: (v: T) => string }) {
  return (
    <div class="chips">
      {values.map((v) => (
        <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {label ? label(v) : String(v)}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" class="tg" aria-pressed={on} aria-label={label} onClick={() => onChange(!on)} />;
}
