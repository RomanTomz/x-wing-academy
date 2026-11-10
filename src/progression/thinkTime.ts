/**
 * Think time: targets arrive with their shields up while the question is read,
 * so careful reading beats spraying shots. Shots bounce off harmlessly and don't
 * count as a try. Pure logic (no Phaser) so it can be tested.
 */
export type ThinkTime = 'off' | 'short' | 'long';
export const THINK_TIMES: readonly ThinkTime[] = ['off', 'short', 'long'];

export interface ThinkWindow {
  /** Shields stay up at least this long (ms after the targets arrive). */
  min: number;
  /** ...and drop by this point even if the question is still being read. */
  max: number;
}

export const THINK_WINDOWS: Record<ThinkTime, ThinkWindow | null> = {
  off: null,
  short: { min: 1500, max: 3000 },
  long: { min: 3000, max: 5000 },
};

/** Shields after a miss: a short breather while the hint shows. */
export const MISS_BREATHER_MS = 1000;

/**
 * Are the targets still shielded? `elapsed` is ms since they arrived, `spoken`
 * whether the question has finished being read aloud (true when speech is off).
 */
export function shieldsUp(setting: ThinkTime, elapsed: number, spoken: boolean): boolean {
  const w = THINK_WINDOWS[setting];
  if (!w) return false;
  if (elapsed < w.min) return true;
  return !spoken && elapsed < w.max;
}

export function isThinkTime(v: unknown): v is ThinkTime {
  return v === 'off' || v === 'short' || v === 'long';
}

/**
 * With three targets, pure guessing is right first time about 1 in 3. Flag a
 * topic for the parent when first-time accuracy stays close to that.
 */
export function mightBeGuessing(t: { attempted: number; firstTryCorrect: number }): boolean {
  return t.attempted >= 10 && t.firstTryCorrect / t.attempted < 0.45;
}
