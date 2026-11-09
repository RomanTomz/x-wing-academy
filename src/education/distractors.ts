import type { Rng } from './rng';

export interface DistractorOptions {
  /** Smallest allowed value (inclusive). */
  min: number;
  /** Largest allowed value (inclusive). */
  max: number;
  count: number;
}

/** Reverse the digits of a two-digit number (a common place-value slip, e.g. 21 vs 12). */
export function swapDigits(n: number): number | null {
  if (n < 10 || n > 99 || n % 10 === 0) return null;
  return (n % 10) * 10 + Math.floor(n / 10);
}

/**
 * Choose plausible wrong answers.
 *
 * `mistakes` are values that reflect common errors (wrong operation, off by ten…)
 * and are preferred; `near` values pad the set. Anything invalid, duplicated or
 * equal to the answer is discarded, and a deterministic ±k search guarantees we
 * always return `count` unique values.
 */
export function chooseDistractors(
  answer: number,
  mistakes: readonly (number | null)[],
  near: readonly (number | null)[],
  rng: Rng,
  opts: DistractorOptions,
): number[] {
  const chosen: number[] = [];
  const valid = (v: number | null): v is number =>
    v !== null &&
    Number.isInteger(v) &&
    v >= opts.min &&
    v <= opts.max &&
    v !== answer &&
    !chosen.includes(v);

  // Take at most one "mistake" value so options are not all far-fetched, then nearby values.
  const pool = [...rng.shuffle(mistakes.filter((m) => m !== null)).slice(0, 1), ...rng.shuffle(near), ...rng.shuffle(mistakes)];
  for (const v of pool) {
    if (chosen.length >= opts.count) break;
    if (valid(v)) chosen.push(v);
  }

  // Fallback: walk outwards from the answer.
  for (let k = 1; chosen.length < opts.count && k < 1000; k++) {
    const candidates = rng.chance(0.5) ? [answer + k, answer - k] : [answer - k, answer + k];
    for (const v of candidates) {
      if (chosen.length < opts.count && valid(v)) chosen.push(v);
    }
  }
  return chosen;
}
