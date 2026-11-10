import { describe, expect, it } from 'vitest';
import { applyResult, boundsFor } from '../src/education/difficulty';
import { countingRules, generateQuestion, isValidQuestion } from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { firstStageOfTier, lastStageOfTier, stageParams } from '../src/education/stages';
import { ALL_TOPICS, type TopicId } from '../src/education/types';
import {
  defaultCampaign,
  isMissionConfig,
  isPlanetUnlocked,
  chainFor,
  EMPIRE_PLANETS,
  LEVELS,
  nextPlanet,
  planetIndex,
  REBEL_PLANETS,
  starsFor,
} from '../src/progression/campaign';
import { GameStore, MemoryStorage } from '../src/persistence/gameStore';
import { sanitizeSave } from '../src/persistence/saveData';

const noneEnabled = Object.fromEntries(ALL_TOPICS.map((t) => [t, false])) as Record<TopicId, boolean>;

describe('planet questions', () => {
  for (const planet of REBEL_PLANETS) {
    for (const level of LEVELS) {
      it(`${planet.name} / level ${level}: valid, on-topic and in range across the level's stages`, () => {
        const rng = createRng(planet.id.length * 100 + level);
        for (let stage = firstStageOfTier(level); stage <= lastStageOfTier(level); stage++) {
          const p = stageParams(stage);
          for (let i = 0; i < 300; i++) {
            // Parent topic switches must not affect planets.
            const q = generateQuestion({ stage, enabledTopics: noneEnabled, rng, topicPool: planet.topics });
            expect(isValidQuestion(q)).toBe(true);
            expect(planet.topics).toContain(q.topic);
            expect(q.answer).toBeGreaterThanOrEqual(0);
            if (q.topic === 'counting') {
              const rules = countingRules(level);
              const step = q.problem.kind === 'sequence' ? Math.abs(q.problem.step) : 0;
              expect(rules.steps).toContain(step);
              expect(Math.max(q.answer, ...(q.problem.kind === 'sequence' ? q.problem.terms : []))).toBeLessThanOrEqual(rules.limit(step));
            } else if (q.topic === 'number-bonds') {
              expect(q.answer).toBeLessThan(Math.max(...p.bondTargets));
            } else {
              expect(q.answer).toBeLessThanOrEqual(p.max);
            }
          }
        }
      });
    }
  }

  it('bonds to 100 use tens (and fives at the top stage), with tens-sized distractors', () => {
    const rng = createRng(9);
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion({ stage: 7, enabledTopics: noneEnabled, rng, topicPool: ['number-bonds'] });
      expect(q.problem.kind === 'equation' && q.problem.result).toBe(100);
      expect(q.answer % 10).toBe(0);
      expect(q.options.every((o) => o % 10 === 0)).toBe(true);
    }
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion({ stage: 8, enabledTopics: noneEnabled, rng, topicPool: ['number-bonds'] });
      expect(q.answer % 5).toBe(0);
    }
  });

  it('counting never offers a number already shown in the sequence', () => {
    const rng = createRng(12);
    for (const stage of [0, 1, 2, 3, 5, 7, 8]) {
      for (let i = 0; i < 300; i++) {
        const q = generateQuestion({ stage, enabledTopics: noneEnabled, rng, topicPool: ['counting'] });
        if (q.problem.kind !== 'sequence') continue;
        const terms = q.problem.terms;
        expect(q.options.filter((o) => terms.includes(o))).toEqual([]);
      }
    }
  });

  it('Ace counting includes some backwards sequences', () => {
    const rng = createRng(10);
    let backwards = 0;
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion({ stage: 7, enabledTopics: noneEnabled, rng, topicPool: ['counting'] });
      if (q.problem.kind === 'sequence' && q.problem.step < 0) backwards++;
    }
    expect(backwards).toBeGreaterThan(20);
  });

  it('campaign difficulty stays inside the chosen level', () => {
    let state = { stage: firstStageOfTier(1), recent: [] as boolean[], sinceChange: 0 };
    for (let i = 0; i < 50; i++) state = applyResult(state, true, boundsFor(false, 1)).state;
    expect(state.stage).toBe(lastStageOfTier(1));
  });
});

describe('planet unlocking', () => {
  it('only the first planet is open at the start', () => {
    const c = defaultCampaign();
    expect(REBEL_PLANETS.map((p) => isPlanetUnlocked(c, p.id, false))).toEqual([true, false, false, false]);
    expect(EMPIRE_PLANETS.map((p) => isPlanetUnlocked(c, p.id, false))).toEqual([true, false, false, false]);
  });

  it('clearing any level of a planet opens the next one', () => {
    const c = defaultCampaign();
    c['training-moon'].cleared[2] = true; // Ace only
    expect(isPlanetUnlocked(c, 'frost-planet', false)).toBe(true);
    expect(isPlanetUnlocked(c, 'dune-world', false)).toBe(false);
  });

  it('parents can open every planet', () => {
    const c = defaultCampaign();
    expect([...REBEL_PLANETS, ...EMPIRE_PLANETS].every((p) => isPlanetUnlocked(c, p.id, true))).toBe(true);
  });

  it('each career is its own chain: winning one side never opens the other', () => {
    const c = defaultCampaign();
    c['tie-academy'].cleared[0] = true;
    expect(isPlanetUnlocked(c, 'jedha', false)).toBe(true);
    expect(isPlanetUnlocked(c, 'yavin-4', false)).toBe(false);
    expect(isPlanetUnlocked(c, 'frost-planet', false)).toBe(false);
    expect(chainFor('empire').map((p) => p.id)).toEqual(['tie-academy', 'jedha', 'yavin-4', 'scarif']);
    expect(planetIndex('scarif')).toBe(3);
    expect(planetIndex('death-star')).toBe(-1);
    expect(nextPlanet('forest-moon')).toBeUndefined();
    expect(nextPlanet('jedha')?.id).toBe('yavin-4');
  });

  it('empire planets each practise one empire skill', () => {
    expect(EMPIRE_PLANETS.map((p) => p.topics)).toEqual([['compare'], ['place-value'], ['odd-even'], ['fractions']]);
    for (const p of EMPIRE_PLANETS) expect(p.faction).toBe('empire');
  });

  it('completing a level awards a star once and unlocks the next planet once', () => {
    const store = new GameStore(new MemoryStorage());
    const first = store.completeMission(1000, { planetId: 'training-moon', level: 1 });
    expect(first.newStar).toBe(true);
    expect(first.planetUnlocked?.id).toBe('frost-planet');
    expect(store.isPlanetUnlocked('frost-planet')).toBe(true);

    const again = store.completeMission(1000, { planetId: 'training-moon', level: 1 });
    expect(again.newStar).toBe(false);
    expect(again.planetUnlocked).toBeNull();

    const pilot = store.completeMission(1000, { planetId: 'training-moon', level: 2 });
    expect(pilot.newStar).toBe(true);
    expect(pilot.planetUnlocked).toBeNull();
    expect(starsFor(store.data.profile.campaign, 'training-moon')).toBe(2);
  });

  it('the last planet unlocks no planet, only its final boss', () => {
    const store = new GameStore(new MemoryStorage());
    const r = store.completeMission(1000, { planetId: 'forest-moon', level: 1 });
    expect(r.planetUnlocked).toBeNull();
    expect(r.bossUnlocked?.id).toBe('death-star');
  });

  it('winning the TIE Academy opens Jedha and the Hoth boss', () => {
    const store = new GameStore(new MemoryStorage());
    const r = store.completeMission(800, { planetId: 'tie-academy', level: 2 });
    expect(r.newStar).toBe(true);
    expect(r.planetUnlocked?.id).toBe('jedha');
    expect(r.bossUnlocked?.id).toBe('hoth-generator');
    expect(store.isPlanetUnlocked('frost-planet')).toBe(false);
  });

  it('quick missions do not award stars', () => {
    const store = new GameStore(new MemoryStorage());
    const r = store.completeMission(1000);
    expect(r.newStar).toBe(false);
    expect(starsFor(store.data.profile.campaign, 'training-moon')).toBe(0);
  });

  it('campaign questions do not move the Quick Mission difficulty', () => {
    const store = new GameStore(new MemoryStorage());
    for (let i = 0; i < 20; i++) store.recordQuestion('number-bonds', true, 1, false);
    expect(store.data.profile.stage).toBe(0);
    expect(store.data.stats.byTopic['number-bonds'].attempted).toBe(20);
  });

  it('campaign progress persists and old saves without it load fine', () => {
    const storage = new MemoryStorage();
    new GameStore(storage).completeMission(500, { planetId: 'training-moon', level: 3 });
    expect(new GameStore(storage).data.profile.campaign['training-moon'].cleared).toEqual([false, false, true]);
    const old = sanitizeSave({ profile: { totalXp: 100 } });
    expect(old.profile.campaign).toEqual(defaultCampaign());
    const junk = sanitizeSave({ profile: { campaign: { 'training-moon': { cleared: ['yes', 1, true] }, nowhere: {} } } });
    expect(junk.profile.campaign['training-moon'].cleared).toEqual([false, false, true]);
  });

  it('validates mission configs passed between scenes', () => {
    expect(isMissionConfig({ mode: 'quick' })).toBe(true);
    expect(isMissionConfig({ mode: 'campaign', planetId: 'dune-world', level: 2 })).toBe(true);
    expect(isMissionConfig({ mode: 'campaign', planetId: 'pluto', level: 2 })).toBe(false);
    expect(isMissionConfig({ mode: 'campaign', planetId: 'dune-world', level: 4 })).toBe(false);
    expect(isMissionConfig(undefined)).toBe(false);
  });
});
