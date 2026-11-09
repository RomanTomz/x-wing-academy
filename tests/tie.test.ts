import { describe, expect, it } from 'vitest';
import { generateQuestion, hintFor, isValidQuestion, solveProblem, TIE_LIMITS } from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { firstStageOfTier, lastStageOfTier } from '../src/education/stages';
import { ALL_TOPICS, COMPARE_SYMBOLS, type TopicId } from '../src/education/types';
import { isPlanetUnlocked, defaultCampaign, LEVELS, TIE_ACADEMY } from '../src/progression/campaign';
import { GameStore, MemoryStorage } from '../src/persistence/gameStore';
import { sanitizeSave } from '../src/persistence/saveData';

const none = Object.fromEntries(ALL_TOPICS.map((t) => [t, false])) as Record<TopicId, boolean>;

function many(topic: TopicId, level: 1 | 2 | 3, count = 300) {
  const rng = createRng(topic.length * 7 + level);
  const out = [];
  for (let stage = firstStageOfTier(level); stage <= lastStageOfTier(level); stage++) {
    for (let i = 0; i < count; i++) out.push(generateQuestion({ stage, enabledTopics: none, rng, topicPool: [topic] }));
  }
  return out;
}

describe('TIE Academy maths', () => {
  for (const level of LEVELS) {
    it(`level ${level}: every topic produces valid, labelled questions`, () => {
      for (const topic of TIE_ACADEMY.topics) {
        for (const q of many(topic, level)) {
          expect(q.topic).toBe(topic);
          expect(isValidQuestion(q)).toBe(true);
          expect(q.optionLabels).toHaveLength(3);
          expect(new Set(q.optionLabels).size).toBe(3);
          expect(q.options).toContain(q.answer);
        }
      }
    });
  }

  it('comparisons use < = > labels that match the numbers', () => {
    for (const level of LEVELS) {
      let equals = 0;
      for (const q of many('compare', level)) {
        expect([...q.optionLabels].sort()).toEqual(['<', '=', '>']);
        if (q.problem.kind !== 'compare') throw new Error('wrong kind');
        const { left, right } = q.problem;
        const expected = left < right ? '<' : left === right ? '=' : '>';
        expect(COMPARE_SYMBOLS[q.answer]).toBe(expected);
        expect(q.optionLabels[q.options.indexOf(q.answer)]).toBe(expected);
        expect(Math.max(left, right)).toBeLessThanOrEqual(TIE_LIMITS[level]);
        if (expected === '=') equals++;
      }
      expect(equals).toBeGreaterThan(0);
    }
  });

  it('place value questions are correct and within range', () => {
    for (const level of LEVELS) {
      for (const q of many('place-value', level)) {
        if (q.problem.kind !== 'place-value') throw new Error('wrong kind');
        const n = q.problem.tens * 10 + q.problem.ones;
        expect(n).toBeLessThanOrEqual(TIE_LIMITS[level] === 100 ? 99 : TIE_LIMITS[level]);
        expect(solveProblem(q.problem)).toBe(q.answer);
        if (q.visual) expect(q.visual).toEqual({ kind: 'blocks', tens: q.problem.tens, ones: q.problem.ones });
      }
    }
  });

  it('fractions always divide exactly', () => {
    for (const level of LEVELS) {
      for (const q of many('fractions', level)) {
        if (q.problem.kind !== 'fraction') throw new Error('wrong kind');
        expect(Number.isInteger(q.answer)).toBe(true);
        expect((q.problem.whole * q.problem.num) % q.problem.den).toBe(0);
      }
    }
  });

  it('odd/even questions have exactly one target of the wanted kind', () => {
    for (const level of LEVELS) {
      for (const q of many('odd-even', level)) {
        if (q.problem.kind !== 'parity') throw new Error('wrong kind');
        const want = q.problem.want === 'even' ? 0 : 1;
        expect(q.options.filter((o) => o % 2 === want)).toEqual([q.answer]);
        expect(Math.max(...q.options)).toBeLessThanOrEqual(TIE_LIMITS[level]);
      }
    }
  });

  it('first-miss hints suit the topic', () => {
    const [cmp] = many('compare', 1, 1);
    expect(hintFor(cmp, 0, 1)).toMatch(/mouth/);
    const [par] = many('odd-even', 1, 1);
    expect(hintFor(par, 3, 1)).toMatch(/Even numbers/);
  });
});

describe('TIE Academy progress', () => {
  it('is always open and never unlocks a galaxy planet', () => {
    expect(isPlanetUnlocked(defaultCampaign(), 'tie-academy', false)).toBe(true);
    const store = new GameStore(new MemoryStorage());
    const r = store.completeMission(800, { planetId: 'tie-academy', level: 2 });
    expect(r.newStar).toBe(true);
    expect(r.planetUnlocked).toBeNull();
    expect(store.isPlanetUnlocked('frost-planet')).toBe(false);
    expect(store.data.profile.campaign['tie-academy'].cleared).toEqual([false, true, false]);
  });

  it('old saves get TIE progress and an X-wing by default; ship choice persists', () => {
    const old = sanitizeSave({ profile: { equipped: { paint: 'paint-red' } } });
    expect(old.profile.campaign['tie-academy'].cleared).toEqual([false, false, false]);
    expect(old.profile.equipped.ship).toBe('x-wing');
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    expect(store.equip('b-wing')).toBe(true);
    expect(new GameStore(storage).data.profile.equipped.ship).toBe('b-wing');
    expect(sanitizeSave({ profile: { equipped: { ship: 'death-star' } } }).profile.equipped.ship).toBe('x-wing');
  });
});
