import { signal } from '@preact/signals';
import { base64ToUtf8, utf8ToBase64 } from './lib/base64';
import type { RepoRef } from './sync/github';

// Réglages propres à CET appareil : dépôt de données, jeton, et rôle (téléphone parent ou tablette enfant).
// Ils ne quittent jamais l'appareil, sauf dans le QR code d'ajout d'un appareil (affiché 60 s derrière le code parent).

export type Role = 'parent' | 'child';

export interface Device extends RepoRef {
  role: Role;
}

const KEY = 'pico-device';

function read(): Device | null {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Device | null;
    return d?.token && d.owner && d.repo && (d.role === 'parent' || d.role === 'child') ? d : null;
  } catch {
    return null;
  }
}

export const device = signal<Device | null>(read());

export function saveDevice(d: Device | null): void {
  if (d) localStorage.setItem(KEY, JSON.stringify(d));
  else localStorage.removeItem(KEY);
  device.value = d;
}

export function repoRef(): RepoRef {
  const d = device.value;
  if (!d) throw new Error('Appareil non configuré');
  return { owner: d.owner, repo: d.repo, token: d.token };
}

// ---------- QR code d'ajout d'un appareil ----------
const PREFIX = 'PICO1:';

export function encodeSetup(d: Device): string {
  return PREFIX + utf8ToBase64(JSON.stringify({ o: d.owner, r: d.repo, t: d.token, role: d.role }));
}

export function decodeSetup(text: string): Device | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const j = JSON.parse(base64ToUtf8(text.slice(PREFIX.length))) as { o: string; r: string; t: string; role: Role };
    if (!j.o || !j.r || !j.t || (j.role !== 'parent' && j.role !== 'child')) return null;
    return { owner: j.o, repo: j.r, token: j.t, role: j.role };
  } catch {
    return null;
  }
}
