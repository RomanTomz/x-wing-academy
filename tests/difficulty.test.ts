import { describe, expect, it } from 'vitest';
import { applyResult, boundsFor, type AdaptiveState } from '../src/education/difficulty';
import { MAX_STAGE } from '../src/education/stages';

const full = boundsFor(true, 1);

function run(results: boolean[], start: AdaptiveState = { stage: 3, recent: [], sinceChange: 0 }, bounds = full) {
  let state = start;
  const changes: (string | null)[] = [];
  for (const r of results) {
    const out = applyResult(state, r, bounds);
    state = out.state;
    changes.push(out.change);
  }
  return { state, changes };
}

describe('adaptive difficulty', () => {
  it('steps up one stage after sustained success', () => {
    const { state, changes } = run([true, true, true, true, true]);
    expect(state.stage).toBe(4);
    expect(changes.filter((c) => c === 'up')).toHaveLength(1);
  });

  it('does not step up on a short lucky streak', () => {
    const { state } = run([true, true, true]);
    expect(state.stage).toBe(3);
  });

  it('never jumps more than one stage at a time', () => {
    const { state } = run(Array(9).fill(true));
    expect(state.stage).toBe(4);
    const { state: s2 } = run(Array(10).fill(true));
    expect(s2.stage).toBe(5);
  });

  it('steps down gently after repeated mistakes', () => {
    const { state, changes } = run([false, false, false]);
    expect(state.stage).toBe(2);
    expect(changes).toEqual([null, null, 'down']);
  });

  it('a single mistake does not lower difficulty', () => {
    const { state } = run([true, false, true, false, true]);
    expect(state.stage).toBe(3);
  });

  it('respects locked tier bounds', () => {
    const locked = boundsFor(false, 1);
    expect(locked).toEqual({ min: 0, max: 2 });
    const { state } = run(Array(30).fill(true), { stage: 0, recent: [], sinceChange: 0 }, locked);
    expect(state.stage).toBe(2);
    const { state: down } = run(Array(30).fill(false), { stage: 2, recent: [], sinceChange: 0 }, locked);
    expect(down.stage).toBe(0);
  });

  it('never leaves the ladder', () => {
    const { state } = run(Array(100).fill(true), { stage: MAX_STAGE, recent: [], sinceChange: 0 });
    expect(state.stage).toBe(MAX_STAGE);
    const { state: low } = run(Array(100).fill(false), { stage: 0, recent: [], sinceChange: 0 });
    expect(low.stage).toBe(0);
  });

  it('clamps an out-of-range starting stage into bounds', () => {
    const { state } = run([true], { stage: 8, recent: [], sinceChange: 0 }, boundsFor(false, 2));
    expect(state.stage).toBe(5);
  });
});
