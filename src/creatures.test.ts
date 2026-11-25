import { describe, expect, it } from 'vitest';
import { CREATURES, nextForm, pointsToNext, previousForm, unlockedCount } from './creatures';
import { newFile } from './model/defaults';
import { addEvent, decide, declare } from './model/ops';
import { earnedPoints } from './model/rules';

describe('créatures', () => {
  it('24 créatures, noms uniques, évolutions dans l\'ordre', () => {
    expect(CREATURES).toHaveLength(24);
    expect(new Set(CREATURES.map((c) => c.name)).size).toBe(24);
    expect(CREATURES.slice(0, 6).every((c) => c.stage === 1)).toBe(true);
    expect(nextForm(CREATURES[0]!)?.name).toBe('Flamiche');
    expect(previousForm(CREATURES[6]!)?.name).toBe('Braisou');
  });

  it('1 créature tous les 10 points gagnés, la jauge, la collection complète', () => {
    expect(unlockedCount(9)).toBe(0);
    expect(unlockedCount(10)).toBe(1);
    expect(pointsToNext(13)).toBe(7);
    expect(unlockedCount(999)).toBe(24);
    expect(pointsToNext(240)).toBe(null);
  });

  it('les achats et le solde de départ ne comptent pas, les surprises oui', () => {
    let f = newFile({ childName: 'T', startPoints: 200, codeHash: 'h', codeSalt: 's', now: new Date().toISOString() });
    f = declare(f, 'c1', 'm1');
    f = decide(f, f.events[0]!.id, true);
    f = addEvent(f, 'c1', { type: 'surprise', points: 3, text: 'merci' });
    f = addEvent(f, 'c1', { type: 'purchase', rewardId: 'r1', title: 'x', emoji: 'x', price: 50 });
    f = addEvent(f, 'c1', { type: 'correct', delta: -5, note: 'x' });
    expect(earnedPoints(f, 'c1')).toBe(4);
  });
});
