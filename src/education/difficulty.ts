import { clampStage, firstStageOfTier, lastStageOfTier, MAX_STAGE, MIN_STAGE } from './stages';
import type { Tier } from './types';

export interface AdaptiveState {
  stage: number;
  /** Recent first-attempt results, oldest first (true = correct first time). */
  recent: boolean[];
  /** Questions answered since the stage last changed. */
  sinceChange: number;
}

export interface StageBounds {
  min: number;
  max: number;
}

export type DifficultyChange = 'up' | 'down' | null;

export const ADAPT_RULES = {
  window: 6,
  /** Step up after this many first-try successes in the last `upWindow` questions… */
  upWindow: 5,
  upNeeded: 4,
  /** …and only after at least this many questions on the current stage. */
  minQuestionsBeforeUp: 4,
  /** Step down after this many first-try misses in the last `downWindow` questions. */
  downWindow: 4,
  downNeeded: 3,
  minQuestionsBeforeDown: 3,
} as const;

/** Adaptive mode can roam the whole ladder; locked mode stays inside the chosen tier. */
export function boundsFor(adaptive: boolean, tier: Tier): StageBounds {
  if (adaptive) return { min: MIN_STAGE, max: MAX_STAGE };
  return { min: firstStageOfTier(tier), max: lastStageOfTier(tier) };
}

export function clampToBounds(stage: number, bounds: StageBounds): number {
  return Math.max(bounds.min, Math.min(bounds.max, clampStage(stage)));
}

/**
 * Feed in one question's result and get the next state. Changes are always a
 * single stage at a time, need sustained evidence, and are rate-limited so the
 * difficulty never lurches.
 */
export function applyResult(
  state: AdaptiveState,
  firstTryCorrect: boolean,
  bounds: StageBounds,
): { state: AdaptiveState; change: DifficultyChange } {
  const recent = [...state.recent, firstTryCorrect].slice(-ADAPT_RULES.window);
  const sinceChange = state.sinceChange + 1;
  const stage = clampToBounds(state.stage, bounds);

  const lastUp = recent.slice(-ADAPT_RULES.upWindow);
  const lastDown = recent.slice(-ADAPT_RULES.downWindow);
  const successes = lastUp.filter(Boolean).length;
  const misses = lastDown.filter((r) => !r).length;

  if (
    firstTryCorrect &&
    sinceChange >= ADAPT_RULES.minQuestionsBeforeUp &&
    lastUp.length >= ADAPT_RULES.upWindow &&
    successes >= ADAPT_RULES.upNeeded &&
    stage < bounds.max
  ) {
    return { state: { stage: stage + 1, recent: [], sinceChange: 0 }, change: 'up' };
  }

  if (
    !firstTryCorrect &&
    sinceChange >= ADAPT_RULES.minQuestionsBeforeDown &&
    misses >= ADAPT_RULES.downNeeded &&
    stage > bounds.min
  ) {
    return { state: { stage: stage - 1, recent: [], sinceChange: 0 }, change: 'down' };
  }

  return { state: { stage, recent, sinceChange }, change: null };
}
