import { describe, expect, it } from 'vitest';
import { generateQuestion, isValidQuestion } from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { firstStageOfTier, lastStageOfTier } from '../src/education/stages';
import { ALL_TOPICS, type TopicId } from '../src/education/types';
import { BOSS_HITS, BOSSES, defaultCampaign, isPlanetUnlocked, LEVELS } from '../src/progression/campaign';
import { Mission } from '../src/progression/mission';
import { GameStore, MemoryStorage } from '../src/persistence/gameStore';
import { sanitizeSave } from '../src/persistence/saveData';
import { isUnlocked, newlyUnlocked } from '../src/progression/unlocks';

const none = Object.fromEntries(ALL_TOPICS.map((t) => [t, false])) as Record<TopicId, boolean>;

describe('times and divide facts (Star Destroyer)', () => {
  for (const level of LEVELS) {
    it(`level ${level}: valid questions using only the 2, 5 and 10 tables`, () => {
      const rng = createRng(level * 13);
      const tables = level === 1 ? [2, 10] : [2, 5, 10];
      for (let stage = firstStageOfTier(level); stage <= lastStageOfTier(level); stage++) {
        for (let i = 0; i < 400; i++) {
          const q = generateQuestion({ stage, enabledTopics: none, rng, topicPool: ['times-divide'] });
          expect(isValidQuestion(q)).toBe(true);
          if (q.problem.kind !== 'equation') throw new Error('expected an equation');
          const { a, op, b, result } = q.problem;
          if (op === '×') expect(tables.includes(a) || tables.includes(b)).toBe(true);
          if (op === '÷') {
            expect(tables).toContain(b);
            expect(a % b).toBe(0);
            expect(result * b).toBe(a);
          }
          if (level === 1) expect(op).toBe('×');
        }
      }
    });
  }

  it('Ace includes missing-factor questions', () => {
    const rng = createRng(5);
    let missing = 0;
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion({ stage: 7, enabledTopics: none, rng, topicPool: ['times-divide'] });
      if (q.problem.kind === 'equation' && q.problem.missing !== 'result') missing++;
    }
    expect(missing).toBeGreaterThan(50);
  });
});

describe('boss battles', () => {
  it('a boss is one continuous fight: fixed hits and no interludes', () => {
    const m = new Mission(BOSS_HITS, { interludes: false });
    const steps: string[] = [];
    for (let guard = 0; guard < 50; guard++) {
      const s = m.advance();
      steps.push(s.type);
      if (s.type === 'complete') break;
      if (s.type === 'question') m.recordAttempt(true);
    }
    expect(steps.filter((s) => s === 'question')).toHaveLength(BOSS_HITS);
    expect(steps).not.toContain('interlude');
  });

  it('the Star Destroyer opens after Training Moon is won', () => {
    const c = defaultCampaign();
    expect(isPlanetUnlocked(c, 'star-destroyer', false)).toBe(false);
    c['training-moon'].cleared[0] = true;
    expect(isPlanetUnlocked(c, 'star-destroyer', false)).toBe(true);
    expect(isPlanetUnlocked(defaultCampaign(), 'star-destroyer', true)).toBe(true);
  });

  it('winning Training Moon reports both the new planet and the new boss', () => {
    const store = new GameStore(new MemoryStorage());
    const r = store.completeMission(1000, { planetId: 'training-moon', level: 1 });
    expect(r.planetUnlocked?.id).toBe('frost-planet');
    expect(r.bossUnlocked?.id).toBe('star-destroyer');
    const again = store.completeMission(1000, { planetId: 'training-moon', level: 2 });
    expect(again.bossUnlocked).toBeNull();
  });

  it('beating a boss gives its prize once, and never unlocks a planet by itself', () => {
    const store = new GameStore(new MemoryStorage());
    store.completeMission(1000, { planetId: 'training-moon', level: 1 });
    expect(store.isRewardUnlocked('paint-destroyer')).toBe(false);
    expect(store.equip('paint-destroyer')).toBe(false);
    const r = store.completeMission(900, { planetId: 'star-destroyer', level: 2 });
    expect(r.newStar).toBe(true);
    expect(r.planetUnlocked).toBeNull();
    expect(r.newUnlocks.map((u) => u.id)).toContain('paint-destroyer');
    expect(store.isRewardUnlocked('paint-destroyer')).toBe(true);
    expect(store.equip('paint-destroyer')).toBe(true);
    const again = store.completeMission(900, { planetId: 'star-destroyer', level: 3 });
    expect(again.newUnlocks.map((u) => u.id)).not.toContain('paint-destroyer');
  });

  it('boss prizes are not part of the per-mission reward track', () => {
    for (let m = 1; m <= 20; m++) expect(newlyUnlocked(m - 1, m).some((u) => u.boss)).toBe(false);
    expect(isUnlocked('paint-destroyer', 99)).toBe(false);
  });

  it('a boss prize cannot be equipped by editing storage', () => {
    const s = sanitizeSave({ profile: { equipped: { paint: 'paint-destroyer' } } });
    expect(s.profile.equipped.paint).toBe('paint-red');
    const won = sanitizeSave({
      profile: { equipped: { paint: 'paint-destroyer' }, campaign: { 'star-destroyer': { cleared: [true, false, false] } } },
    });
    expect(won.profile.equipped.paint).toBe('paint-destroyer');
  });

  it('every boss sits after a real planet', () => {
    for (const b of BOSSES) expect(b.unlockAfter).toBeDefined();
  });
});
