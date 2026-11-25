import { describe, expect, it } from 'vitest';
import { newFile } from './defaults';
import { mergePico } from './merge';
import { addEvent, bestOf, decide, decideAll, declare, startPlay, finishPlay, updateChild } from './ops';
import { balance, gamesLeft, lastDays, missionRates, nowState, pendingDeclarations } from './rules';
import { periodAt } from './time';
import type { PicoFile } from './types';
import { parsePicoFile } from './validate';

// Mardi 24 novembre 2026 (jour d'école), heures locales.
const at = (h: number, m = 0, day = 24) => new Date(2026, 10, day, h, m);
const base = () => newFile({ childName: 'Test', startPoints: 10, codeHash: 'h', codeSalt: 's', now: at(7).toISOString() });
const child = (f: PicoFile) => f.children[0]!;

describe('moments de la journée', () => {
  const s = base().settings;
  it('découpe la journée', () => {
    expect(periodAt(s, at(5, 59))).toBe('nuit');
    expect(periodAt(s, at(7, 30))).toBe('matin');
    expect(periodAt(s, at(16, 30))).toBe('aprem');
    expect(periodAt(s, at(19, 15))).toBe('soir');
    expect(periodAt(s, at(20, 0))).toBe('nuit');
  });
});

describe('missions et points', () => {
  it('affiche les missions actives du moment, 5 au maximum', () => {
    const f = base();
    const st = nowState(f, child(f), at(7, 30));
    expect(st.visible.map((v) => v.mission.title)).toEqual(["S'habiller seul", 'Se brosser les dents', 'Mettre ses chaussures du 1er coup']);
    expect(st.balance).toBe(10);
    expect(st.games).toBe(0);
  });

  it('mission du vendredi « à partir de 16 h » : cachée avant, visible après, toute la soirée', () => {
    let f = base();
    f = { ...f, missions: [...f.missions, { id: 'mx', childId: 'c1', title: 'Pas de croix', emoji: '✅', points: 10, givesGame: true, moment: 'jour', days: [5], from: '16:00', active: true, updatedAt: '' }] };
    const fri = (h: number) => new Date(2026, 10, 27, h, 0);
    const titles = (d: Date) => nowState(f, child(f), d).visible.map((v) => v.mission.title);
    expect(titles(fri(15))).not.toContain('Pas de croix');
    expect(titles(fri(16))).toContain('Pas de croix');
    expect(titles(fri(19))).toContain('Pas de croix');
    expect(titles(at(17))).not.toContain('Pas de croix'); // mardi
  });

  it('« J\'ai fini » → en attente → validé : points + 1 partie', () => {
    let f = base();
    f = declare(f, 'c1', 'm1', at(7, 30));
    let st = nowState(f, child(f), at(7, 31));
    expect(st.visible[0]!.status).toBe('pending');
    expect(pendingDeclarations(f, 'c1')).toHaveLength(1);
    f = decide(f, st.visible[0]!.declareId!, true, at(7, 35));
    st = nowState(f, child(f), at(7, 36));
    expect(st.visible[0]!.status).toBe('done');
    expect(st.balance).toBe(11);
    expect(st.games).toBe(1);
    expect(pendingDeclarations(f, 'c1')).toHaveLength(0);
  });

  it('« Pas encore » : neutre, la mission revient à faire', () => {
    let f = declare(base(), 'c1', 'm1', at(7, 30));
    f = decide(f, f.events[0]!.id, false, at(7, 32));
    const st = nowState(f, child(f), at(7, 33));
    expect(st.visible[0]!.status).toBe('todo');
    expect(st.balance).toBe(10);
  });

  it('deux téléphones valident en même temps : compté une seule fois', () => {
    const start = declare(base(), 'c1', 'm1', at(7, 30));
    const id = start.events[0]!.id;
    const phoneA = decide(start, id, true, at(7, 35));
    const phoneB = decide(start, id, true, at(7, 36));
    const merged = mergePico(start, phoneA, phoneB);
    expect(merged.events.filter((e) => e.type === 'validate')).toHaveLength(2);
    expect(balance(merged, child(merged))).toBe(11);
    expect(gamesLeft(merged, 'c1', '2026-11-24')).toBe(1);
  });

  it('validation un autre jour : points seulement, pas de partie', () => {
    let f = declare(base(), 'c1', 'm1', at(7, 30));
    f = decide(f, f.events[0]!.id, true, at(8, 0, 25));
    expect(balance(f, child(f))).toBe(11);
    expect(gamesLeft(f, 'c1', '2026-11-25')).toBe(0);
  });

  it('missions du soir : pas de partie', () => {
    let f = declare(base(), 'c1', 'm11', at(19, 0));
    f = decide(f, f.events[0]!.id, true, at(19, 5));
    expect(gamesLeft(f, 'c1', '2026-11-24')).toBe(0);
    expect(balance(f, child(f))).toBe(12);
  });

  it('les parties sont perdues à minuit et se consomment en jouant', () => {
    let f = declare(base(), 'c1', 'm1', at(7, 30));
    f = declare(f, 'c1', 'm2', at(7, 31));
    f = decideAll(f, [f.events[0]!.id, f.events[1]!.id], at(7, 40));
    expect(gamesLeft(f, 'c1', '2026-11-24')).toBe(2);
    f = startPlay(f, 'c1', 'course', at(16, 0));
    f = finishPlay(f, 'c1', 'course', 12, 3, 60, at(16, 1));
    expect(gamesLeft(f, 'c1', '2026-11-24')).toBe(1);
    expect(gamesLeft(f, 'c1', '2026-11-25')).toBe(0);
    expect(child(f).best).toBe(12);
    expect(child(f).level).toBe(1.05);
    // Un autre jeu a son propre record, la course garde le sien.
    f = startPlay(f, 'c1', 'verger', at(17, 0));
    f = finishPlay(f, 'c1', 'verger', 7, 0, 40, at(17, 1));
    expect(gamesLeft(f, 'c1', '2026-11-24')).toBe(0);
    expect(bestOf(child(f), 'verger')).toBe(7);
    expect(bestOf(child(f), 'course')).toBe(12);
  });

  it('surprise, achat et correction', () => {
    let f = base();
    f = addEvent(f, 'c1', { type: 'surprise', points: 2, text: 'merci' }, at(9));
    f = addEvent(f, 'c1', { type: 'purchase', rewardId: 'r1', title: 'Dessert', emoji: '🍨', price: 5 }, at(10));
    f = addEvent(f, 'c1', { type: 'correct', delta: -1, note: 'erreur' }, at(11));
    expect(balance(f, child(f))).toBe(6);
  });
});

describe('nuit, soirée spéciale, journée pause', () => {
  it('à 20 h Pico dort, rien n\'est affiché', () => {
    const f = base();
    const st = nowState(f, child(f), at(20, 15));
    expect(st.night).toBe(true);
    expect(st.visible).toHaveLength(0);
  });

  it('soirée spéciale jusqu\'à 22 h', () => {
    const f = addEvent(base(), 'c1', { type: 'special', on: true, until: '22:00' }, at(19, 0));
    expect(nowState(f, child(f), at(20, 30)).night).toBe(false);
    expect(nowState(f, child(f), at(22, 1)).night).toBe(true);
    // Le lendemain matin, plus rien.
    expect(nowState(f, child(f), at(5, 0, 25)).night).toBe(true);
  });

  it('journée pause : missions masquées, jour non compté', () => {
    const f = addEvent(base(), 'c1', { type: 'pause', on: true }, at(7));
    expect(nowState(f, child(f), at(7, 30)).visible).toHaveLength(0);
    const days = lastDays(f, 'c1', at(18));
    expect(days.at(-1)!.planned).toBe(0);
  });
});

describe('bilan', () => {
  it('compte les missions prévues et réussies', () => {
    let f = declare(base(), 'c1', 'm1', at(7, 30));
    f = decide(f, f.events[0]!.id, true, at(7, 35));
    const today = lastDays(f, 'c1', at(18)).at(-1)!;
    expect(today.planned).toBe(9);
    expect(today.validated).toBe(1);
    expect(today.points).toBe(1);
    const r = missionRates(f, 'c1', at(18)).find((x) => x.mission.id === 'm1')!;
    expect(r.validated).toBe(1);
    expect(r.planned).toBe(7);
  });
});

describe('fusion et format', () => {
  it('garde les modifications des deux appareils', () => {
    const b = base();
    const local = updateChild(b, 'c1', { scarf: '#E8475B' }, at(9));
    const remote = declare(b, 'c1', 'm1', at(9, 1));
    const m = mergePico(b, local, remote);
    expect(child(m).scarf).toBe('#E8475B');
    expect(m.events).toHaveLength(1);
  });

  it('relit le fichier et complète les champs manquants', () => {
    const f = base();
    const raw = JSON.parse(JSON.stringify({ ...f, children: [{ ...child(f), level: undefined }] }));
    expect(parsePicoFile(raw)?.children[0]!.level).toBe(1);
    expect(parsePicoFile({ schemaVersion: 2 })).toBeNull();
  });
});
