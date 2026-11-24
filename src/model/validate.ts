import { defaultSettings } from './defaults';
import type { PicoFile } from './types';

// Vérifie qu'un JSON lu (GitHub ou copie locale) ressemble bien à pico.json, et complète les champs ajoutés plus tard.

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function parsePicoFile(raw: unknown): PicoFile | null {
  if (!isObj(raw) || raw.schemaVersion !== 1) return null;
  const s = raw.settings;
  if (!isObj(s) || typeof s.codeHash !== 'string' || typeof s.codeSalt !== 'string') return null;
  for (const k of ['children', 'missions', 'rewards', 'events'] as const) if (!Array.isArray(raw[k])) return null;
  const f = raw as unknown as PicoFile;
  if (!f.children.length) return null;
  return {
    ...f,
    settings: { ...defaultSettings(f.settings.updatedAt ?? new Date(0).toISOString()), ...f.settings },
    children: f.children.map((c) => {
      const raw = c as Partial<typeof c>;
      return { ...c, level: raw.level ?? 1, best: raw.best ?? 0, dreamId: raw.dreamId ?? null, introDone: raw.introDone ?? false };
    }),
  };
}
