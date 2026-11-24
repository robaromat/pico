import type { PicoEvent, PicoFile } from './types';

// Fusion « à trois » quand deux appareils ont écrit pico.json en même temps (repris de Boire & Manger).
//   base   = la dernière version que CET appareil a lue/écrite sur GitHub
//   local  = ce que cet appareil veut enregistrer
//   remote = ce qui est sur GitHub maintenant
// - événements : on garde l'union (le journal ne fait que grandir, un événement n'est jamais modifié) ;
// - enfants, missions, récompenses : entrée par entrée, la plus récente (updatedAt) gagne si les deux ont changé ;
// - réglages : le plus récent gagne.

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function mergeEntities<T>(
  base: ReadonlyMap<string, T>,
  local: ReadonlyMap<string, T>,
  remote: ReadonlyMap<string, T>,
  resolveBoth: (l: T, r: T, b: T | undefined) => T,
): Map<string, T> {
  const ids = [...new Set([...remote.keys(), ...local.keys()])];
  const out = new Map<string, T>();
  for (const id of ids) {
    const l = local.get(id);
    const r = remote.get(id);
    const b = base.get(id);
    let v: T | undefined;
    if (l && r) {
      if (same(l, r)) v = l;
      else if (b && same(l, b)) v = r;
      else if (b && same(r, b)) v = l;
      else v = resolveBoth(l, r, b);
    } else if (l) {
      if (!b || !same(l, b)) v = l;
    } else if (r) {
      if (!b || !same(r, b)) v = r;
    }
    if (v !== undefined) out.set(id, v);
  }
  return out;
}

const byId = <T extends { id: string }>(xs: T[] | undefined) => new Map((xs ?? []).map((x) => [x.id, x] as const));
const newer = <T extends { updatedAt: string }>(l: T, r: T) => (l.updatedAt >= r.updatedAt ? l : r);

export function mergePico(base: PicoFile | null, local: PicoFile, remote: PicoFile): PicoFile {
  const events = new Map<string, PicoEvent>();
  for (const e of remote.events) events.set(e.id, e);
  for (const e of local.events) events.set(e.id, e);
  return {
    schemaVersion: 1,
    settings: newer(local.settings, remote.settings),
    children: [...mergeEntities(byId(base?.children), byId(local.children), byId(remote.children), newer).values()],
    missions: [...mergeEntities(byId(base?.missions), byId(local.missions), byId(remote.missions), newer).values()],
    rewards: [...mergeEntities(byId(base?.rewards), byId(local.rewards), byId(remote.rewards), newer).values()],
    events: [...events.values()].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0)),
  };
}
