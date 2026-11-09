import { describe, expect, it } from 'vitest';
import { chooseDistractors, swapDigits } from '../src/education/distractors';
import {
  fallbackQuestion,
  generateQuestion,
  hintFor,
  isValidQuestion,
  NUMBER_WORDS,
  solveProblem,
} from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { MAX_STAGE, STAGES, TIER_TOPICS, stageParams } from '../src/education/stages';
import { ALL_TOPICS, type TopicId } from '../src/education/types';

const allEnabled = Object.fromEntries(ALL_TOPICS.map((t) => [t, true])) as Record<TopicId, boolean>;

describe('question generation', () => {
  for (const params of STAGES) {
    for (const topic of TIER_TOPICS[params.tier]) {
      it(`stage ${params.stage} / ${topic}: 500 questions are valid, unique and in range`, () => {
        const rng = createRng(1000 + params.stage * 31 + topic.length);
        for (let i = 0; i < 500; i++) {
          const q = generateQuestion({ stage: params.stage, enabledTopics: allEnabled, rng, topic });
          expect(q.topic).toBe(topic);
          expect(isValidQuestion(q)).toBe(true);
          expect(q.options).toHaveLength(3);
          expect(new Set(q.options).size).toBe(3);
          expect(q.options).toContain(q.answer);
          expect(q.options.every((o) => Number.isInteger(o) && o >= 0)).toBe(true);
          expect(solveProblem(q.problem)).toBe(q.answer);
          // Answers stay within the stage's number range (multiplication has its own table range).
          if (topic === 'number-bonds') expect(q.answer).toBeLessThan(Math.max(...params.bondTargets));
          else if (topic === 'counting') expect(q.answer).toBeLessThanOrEqual(100);
          else if (topic !== 'multiplication' && topic !== 'recognition') expect(q.answer).toBeLessThanOrEqual(params.max);
          expect(q.display).toContain(topic === 'recognition' ? NUMBER_WORDS[q.answer] : '?');
        }
      });
    }
  }

  it('equations are arithmetically correct', () => {
    const rng = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const q = generateQuestion({ stage: i % (MAX_STAGE + 1), enabledTopics: allEnabled, rng });
      if (q.problem.kind === 'equation') {
        const { a, op, b, result } = q.problem;
        const computed = op === '+' ? a + b : op === '-' ? a - b : a * b;
        expect(computed).toBe(result);
        expect(result).toBeGreaterThanOrEqual(0);
      }
      if (q.problem.kind === 'sequence') {
        const { terms, step } = q.problem;
        for (let k = 1; k < terms.length; k++) expect(terms[k] - terms[k - 1]).toBe(step);
      }
    }
  });

  it('subtraction never produces negative answers', () => {
    const rng = createRng(99);
    for (let stage = 0; stage <= MAX_STAGE; stage++) {
      for (let i = 0; i < 300; i++) {
        const q = generateQuestion({ stage, enabledTopics: allEnabled, rng, topic: 'subtraction' });
        expect(q.answer).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('only uses topics the parent enabled (when available at the tier)', () => {
    const rng = createRng(3);
    const onlyBonds = Object.fromEntries(ALL_TOPICS.map((t) => [t, t === 'number-bonds'])) as Record<TopicId, boolean>;
    for (let i = 0; i < 100; i++) {
      expect(generateQuestion({ stage: 1, enabledTopics: onlyBonds, rng }).topic).toBe('number-bonds');
    }
  });

  it('falls back to tier topics if none of the enabled topics fit the tier', () => {
    const rng = createRng(4);
    const onlyMultiplication = Object.fromEntries(ALL_TOPICS.map((t) => [t, t === 'multiplication'])) as Record<TopicId, boolean>;
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion({ stage: 0, enabledTopics: onlyMultiplication, rng });
      expect(TIER_TOPICS[1]).toContain(q.topic);
      expect(isValidQuestion(q)).toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateQuestion({ stage: 4, enabledTopics: allEnabled, rng: createRng(42) });
    const b = generateQuestion({ stage: 4, enabledTopics: allEnabled, rng: createRng(42) });
    expect({ ...a, id: 0 }).toEqual({ ...b, id: 0 });
  });

  it('avoids repeating a recently shown question when possible', () => {
    const rng = createRng(5);
    const recent: string[] = [];
    let repeats = 0;
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion({ stage: 5, enabledTopics: allEnabled, rng, recentDisplays: recent });
      if (recent.includes(q.display)) repeats++;
      recent.push(q.display);
      if (recent.length > 8) recent.shift();
    }
    expect(repeats).toBe(0);
  });

  it('example from the brief: 7 + 5 options are sensible', () => {
    const rng = createRng(1);
    const d = chooseDistractors(12, [2, 22, 2, 21], [13, 11, 14, 10], rng, { min: 0, max: 30, count: 2 });
    expect(d).toHaveLength(2);
    expect(d).not.toContain(12);
    expect(new Set(d).size).toBe(2);
  });

  it('fallback question is valid', () => {
    expect(isValidQuestion(fallbackQuestion(0))).toBe(true);
  });

  it('stage parameters grow gently', () => {
    for (let s = 1; s <= MAX_STAGE; s++) {
      expect(stageParams(s).max).toBeGreaterThan(stageParams(s - 1).max);
      expect(stageParams(s).max / stageParams(s - 1).max).toBeLessThanOrEqual(2);
    }
  });
});

describe('distractors', () => {
  it('always returns the requested count of unique, valid values even with no candidates', () => {
    const rng = createRng(11);
    for (let answer = 0; answer <= 20; answer++) {
      const d = chooseDistractors(answer, [], [], rng, { min: 0, max: 20, count: 2 });
      expect(d).toHaveLength(2);
      expect(d.every((v) => v >= 0 && v <= 20 && v !== answer)).toBe(true);
      expect(new Set(d).size).toBe(2);
    }
  });

  it('rejects negatives, duplicates and the answer itself', () => {
    const rng = createRng(12);
    const d = chooseDistractors(3, [3, -1, 3, null], [3, -2, 4, 4], rng, { min: 0, max: 10, count: 2 });
    expect(d).not.toContain(3);
    expect(d.every((v) => v >= 0)).toBe(true);
    expect(new Set(d).size).toBe(2);
  });

  it('swapDigits handles place-value reversals', () => {
    expect(swapDigits(12)).toBe(21);
    expect(swapDigits(7)).toBeNull();
    expect(swapDigits(30)).toBeNull();
  });
});

describe('hints', () => {
  const q = fallbackQuestion(0); // 2 + 3 = 5
  it('says too big / too small first', () => {
    expect(hintFor(q, 6, 1)).toMatch(/too big/);
    expect(hintFor(q, 4, 1)).toMatch(/too small/);
  });
  it('gives a strategy after repeated mistakes', () => {
    expect(hintFor(q, 6, 2)).toBe(q.strategy);
  });
});
