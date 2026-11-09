import type { StageParams, Tier, TopicId } from './types';

/**
 * Difficulty is a ladder of 9 small stages (3 per tier) so adaptive changes
 * are gentle: numbers grow a little at a time rather than jumping from 10 to 100.
 */
export const STAGES: readonly StageParams[] = [
  { stage: 0, tier: 1, max: 5, bondTargets: [5], tables: [], maxFactor: 0 },
  { stage: 1, tier: 1, max: 7, bondTargets: [5, 10], tables: [], maxFactor: 0 },
  { stage: 2, tier: 1, max: 10, bondTargets: [10], tables: [], maxFactor: 0 },
  { stage: 3, tier: 2, max: 13, bondTargets: [10, 20], tables: [], maxFactor: 0 },
  { stage: 4, tier: 2, max: 16, bondTargets: [20], tables: [], maxFactor: 0 },
  { stage: 5, tier: 2, max: 20, bondTargets: [20], tables: [], maxFactor: 0 },
  { stage: 6, tier: 3, max: 30, bondTargets: [20, 100], tables: [2, 10], maxFactor: 5 },
  { stage: 7, tier: 3, max: 60, bondTargets: [100], tables: [2, 5, 10], maxFactor: 8 },
  { stage: 8, tier: 3, max: 100, bondTargets: [100], tables: [2, 5, 10], maxFactor: 10 },
];

export const MIN_STAGE = 0;
export const MAX_STAGE = STAGES.length - 1;

export function clampStage(stage: number): number {
  if (!Number.isFinite(stage)) return MIN_STAGE;
  return Math.max(MIN_STAGE, Math.min(MAX_STAGE, Math.round(stage)));
}

export function stageParams(stage: number): StageParams {
  return STAGES[clampStage(stage)];
}

export function tierOfStage(stage: number): Tier {
  return stageParams(stage).tier;
}

export function firstStageOfTier(tier: Tier): number {
  return (tier - 1) * 3;
}

export function lastStageOfTier(tier: Tier): number {
  return (tier - 1) * 3 + 2;
}

/** Topics that make sense at each tier (UK Year 2 progression). */
export const TIER_TOPICS: Record<Tier, readonly TopicId[]> = {
  1: ['recognition', 'addition', 'subtraction', 'number-bonds'],
  2: ['addition', 'subtraction', 'number-bonds', 'missing-number'],
  3: ['addition', 'subtraction', 'counting', 'multiplication', 'two-step'],
};

/**
 * Topics to draw from given the parent's enabled set. If the parent switched off
 * every topic available at this tier, fall back to all of them rather than
 * producing nothing.
 */
export function availableTopics(tier: Tier, enabled: Readonly<Record<TopicId, boolean>>): TopicId[] {
  const tierTopics = TIER_TOPICS[tier];
  const chosen = tierTopics.filter((t) => enabled[t]);
  return chosen.length > 0 ? chosen : [...tierTopics];
}
