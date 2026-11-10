import { describe, expect, it } from 'vitest';
import { countHops, hintPicture, MAX_DOTS, pictureResult } from '../src/education/hintPictures';
import { generateQuestion } from '../src/education/questionGenerator';
import { createRng } from '../src/education/rng';
import { MAX_STAGE } from '../src/education/stages';
import { ALL_TOPICS, type TopicId } from '../src/education/types';

const none = Object.fromEntries(ALL_TOPICS.map((t) => [t, false])) as Record<TopicId, boolean>;

describe('hint pictures', () => {
  it('count on in ones for small numbers, and tens then ones for big ones', () => {
    expect(countHops(7, 3).map((h) => h.to)).toEqual([8, 9, 10]);
    expect(countHops(45, 23).map((h) => h.to)).toEqual([55, 65, 66, 67, 68]);
    expect(countHops(52, -14).map((h) => h.to)).toEqual([42, 41, 40, 39, 38]);
  });

  for (const topic of ALL_TOPICS) {
    it(`${topic}: every question at every stage gets a picture that works out to the answer`, () => {
      const rng = createRng(topic.length * 17);
      for (let stage = 0; stage <= MAX_STAGE; stage++) {
        for (let i = 0; i < 150; i++) {
          const q = generateQuestion({ stage, enabledTopics: none, rng, topicPool: [topic] });
          const pic = hintPicture(q, q.options.find((o) => o !== q.answer));
          expect(pic, q.display).not.toBeNull();
          if (!pic) continue;
          const result = pictureResult(pic);
          if (pic.kind === 'blocks') {
            // Tens and ones / comparing: the blocks show the numbers in the question.
            expect(pic.numbers.length).toBeGreaterThan(0);
          } else if (pic.kind === 'pairs') {
            expect(pic.value).toBeGreaterThanOrEqual(0);
            expect(pic.value).toBeLessThanOrEqual(20);
          } else if (q.problem.kind === 'equation' && q.problem.op === '×' && q.problem.missing !== 'result' && pic.kind === 'numberline') {
            // Missing factor: count the jumps.
            expect(pic.hops.length).toBe(q.answer);
          } else if (q.problem.kind === 'equation' && q.problem.op === '÷' && pic.kind === 'numberline') {
            expect(pic.hops.length).toBe(q.answer);
          } else {
            expect(result, `${q.display} → ${JSON.stringify(pic)}`).toBe(q.answer);
          }
          // Drawable sizes.
          if (pic.kind === 'array') expect(pic.rows * pic.cols).toBeLessThanOrEqual(MAX_DOTS);
          if (pic.kind === 'share') expect(pic.total).toBeLessThanOrEqual(MAX_DOTS);
          if (pic.kind === 'numberline') {
            expect(pic.hops.length).toBeLessThanOrEqual(16);
            expect(pic.min).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });
  }

  it('odd and even shows the number that was shot', () => {
    const rng = createRng(3);
    const q = generateQuestion({ stage: 2, enabledTopics: none, rng, topicPool: ['odd-even'] });
    const wrong = q.options.find((o) => o !== q.answer)!;
    const pic = hintPicture(q, wrong);
    expect(pic).toEqual({ kind: 'pairs', value: wrong <= 20 ? wrong : wrong % 10 || 10 });
  });
});
