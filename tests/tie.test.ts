import { describe, expect, it } from 'vitest';
import { generateQuestion, hintFor, isValidQuestion, solveProblem, TIE_LIMITS } from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { firstStageOfTier, lastStageOfTier } from '../src/education/stages';
import { ALL_TOPICS, COMPARE_SYMBOLS, type TopicId } from '../src/education/types';
import { EMPIRE_PLANETS, isPlanetUnlocked, defaultCampaign, LEVELS } from '../src/progression/campaign';
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

describe('Empire career maths', () => {
  for (const level of LEVELS) {
    it(`level ${level}: every topic produces valid, labelled questions`, () => {
      for (const topic of EMPIRE_PLANETS.flatMap((p) => p.topics)) {
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

describe('sides and starfighters', () => {
  it('the TIE Academy is the always-open first Empire planet', () => {
    expect(isPlanetUnlocked(defaultCampaign(), 'tie-academy', false)).toBe(true);
    const store = new GameStore(new MemoryStorage());
    store.completeMission(800, { planetId: 'tie-academy', level: 2 });
    expect(store.data.profile.campaign['tie-academy'].cleared).toEqual([false, true, false]);
  });

  it('old saves start as Rebels with a TIE fighter waiting in the hangar', () => {
    const old = sanitizeSave({ profile: { equipped: { ship: 'y-wing', paint: 'paint-red', laser: 'laser-red', trail: 'trail-blue' } } });
    expect(old.profile.faction).toBe('rebel');
    expect(old.profile.equipped.ship).toBe('y-wing');
    expect(old.profile.equipped.tieShip).toBe('tie-fighter');
    expect(old.profile.equipped.tiePaint).toBe('paint-imperial');
    expect(old.profile.equipped.tieLaser).toBe('laser-green');
    expect(sanitizeSave({ profile: { faction: 'sith' } }).profile.faction).toBe('rebel');
  });

  it('each side keeps its own ship, paint and lasers; engines and droid are shared', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    expect(store.equip('b-wing', 'rebel')).toBe(true);
    expect(store.equip('tie-interceptor', 'empire')).toBe(true);
    expect(store.equip('paint-red', 'empire')).toBe(true);
    expect(store.equip('laser-red', 'empire')).toBe(true);
    const reloaded = new GameStore(storage);
    expect(reloaded.loadout('rebel')).toMatchObject({ ship: 'b-wing', paint: 'paint-red', laser: 'laser-red' });
    expect(reloaded.loadout('empire')).toMatchObject({ ship: 'tie-interceptor', paint: 'paint-red', laser: 'laser-red' });
    expect(reloaded.loadout('rebel').trail).toBe(reloaded.loadout('empire').trail);
  });

  it("a side can't fly the other side's ships, even by editing storage", () => {
    const store = new GameStore(new MemoryStorage());
    expect(store.equip('tie-bomber', 'rebel')).toBe(false);
    expect(store.equip('x-wing', 'empire')).toBe(false);
    const edited = sanitizeSave({ profile: { equipped: { ship: 'tie-bomber', tieShip: 'x-wing' } } });
    expect(edited.profile.equipped.ship).toBe('x-wing');
    expect(edited.profile.equipped.tieShip).toBe('tie-fighter');
    expect(sanitizeSave({ profile: { equipped: { ship: 'death-star' } } }).profile.equipped.ship).toBe('x-wing');
  });

  it('the chosen side persists', () => {
    const storage = new MemoryStorage();
    new GameStore(storage).setFaction('empire');
    const store = new GameStore(storage);
    expect(store.faction).toBe('empire');
    expect(store.loadout().ship).toBe('tie-fighter');
  });
});
