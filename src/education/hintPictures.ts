import type { Question } from './types';

/**
 * Pictures for hints, using the representations Year 2 classrooms use: number
 * lines, ten-frames, part-whole bars, arrays, sharing into groups, base-ten
 * blocks, fraction bars and pairs. This module only decides WHAT to draw (pure
 * data, unit-tested); ui/HintPicture.ts draws it.
 *
 * On the first miss the picture shows the set-up (the answer is a "?"); on the
 * second miss it plays out the method and reveals the answer. By then only one
 * target is left, so revealing it gives nothing away.
 */

export interface Hop {
  from: number;
  to: number;
}

export type HintPicture =
  /** Hops along a number line from `start`; the last hop lands on the answer. */
  | { kind: 'numberline'; min: number; max: number; start: number; hops: Hop[] }
  /** Ten-frame(s) with `filled` counters. `ask` says whether the answer is the counters or the empty spaces. */
  | { kind: 'tenframe'; size: 5 | 10 | 20; filled: number; ask: 'filled' | 'empty' }
  /** Part-whole bar. `null` marks the missing number. */
  | { kind: 'bar'; whole: number | null; parts: [number | null, number | null] }
  /** `rows` rows of `cols` dots. */
  | { kind: 'array'; rows: number; cols: number }
  /** `total` dots shared equally into `groups` circles. */
  | { kind: 'share'; total: number; groups: number }
  /** One or two numbers as tens rods and ones cubes. */
  | { kind: 'blocks'; numbers: { tens: number; ones: number }[] }
  /** A bar cut into `den` equal parts with `num` shaded, worth `whole` altogether. */
  | { kind: 'fraction'; whole: number; num: number; den: number }
  /** `value` dots arranged in pairs: an odd number has one left over. */
  | { kind: 'pairs'; value: number };

/** Biggest number of dots we draw before switching to a number line. */
export const MAX_DOTS = 40;

/** Count on (or back) from `start` by `by`: in ones for small jumps, else tens then ones. */
export function countHops(start: number, by: number): Hop[] {
  const sign = by < 0 ? -1 : 1;
  const size = Math.abs(by);
  const hops: Hop[] = [];
  let at = start;
  if (size <= 10) {
    for (let i = 0; i < size; i++) hops.push({ from: at, to: (at += sign) });
    return hops;
  }
  // Year 2 method for bigger numbers: jump the tens first, then the ones.
  for (let i = 0; i < Math.floor(size / 10); i++) hops.push({ from: at, to: (at += sign * 10) });
  for (let i = 0; i < size % 10; i++) hops.push({ from: at, to: (at += sign) });
  return hops;
}

/** Equal jumps of `step` from `start`, `count` times. */
export function stepHops(start: number, step: number, count: number): Hop[] {
  return Array.from({ length: count }, (_, i) => ({ from: start + i * step, to: start + (i + 1) * step }));
}

function line(start: number, hops: Hop[]): HintPicture {
  const points = [start, ...hops.map((h) => h.to)];
  return { kind: 'numberline', min: Math.min(...points), max: Math.max(...points), start, hops };
}

/** The picture for a question, or null if none fits. */
export function hintPicture(q: Question, wrongValue?: number): HintPicture | null {
  const p = q.problem;
  switch (p.kind) {
    case 'recognition':
      return { kind: 'tenframe', size: p.value <= 5 ? 5 : p.value <= 10 ? 10 : 20, filled: p.value, ask: 'filled' };

    case 'equation': {
      const { a, b, result, op, missing } = p;
      if (q.topic === 'number-bonds' && op === '+' && missing === 'b') {
        if (result === 5 || result === 10 || result === 20) return { kind: 'tenframe', size: result, filled: a, ask: 'empty' };
        return { kind: 'bar', whole: result, parts: [a, null] };
      }
      if (op === '+' || op === '-') {
        if (missing === 'result') return line(a, countHops(a, op === '+' ? b : -b));
        // Missing numbers: a part-whole bar shows how the three numbers fit together.
        if (op === '+') return { kind: 'bar', whole: result, parts: [missing === 'a' ? null : a, missing === 'b' ? null : b] };
        return { kind: 'bar', whole: missing === 'a' ? null : a, parts: [missing === 'b' ? null : b, result] };
      }
      if (op === '×') {
        if (missing === 'result') {
          if (a * b <= MAX_DOTS) return { kind: 'array', rows: a, cols: b };
          // Count in the bigger table: 7 × 10 → seven jumps of 10.
          const [step, count] = b >= a ? [b, a] : [a, b];
          return line(0, stepHops(0, step, count));
        }
        // ? × 5 = 35: count in 5s to 35 and count the jumps.
        const known = missing === 'a' ? b : a;
        return line(0, stepHops(0, known, result / known));
      }
      // Division: share into groups, or count in jumps for big numbers.
      if (a <= MAX_DOTS && b <= 10) return { kind: 'share', total: a, groups: b };
      return line(0, stepHops(0, b, a / b));
    }

    case 'sequence': {
      const { terms, step } = p;
      const last = terms[terms.length - 1];
      return line(terms[0], [...stepHops(terms[0], step, terms.length - 1), { from: last, to: last + step }]);
    }

    case 'two-step': {
      // One big jump per step, labelled with its size: "+5", then "−3".
      const mid = p.op1 === '+' ? p.a + p.b : p.a - p.b;
      const end = p.op2 === '+' ? mid + p.c : mid - p.c;
      return line(p.a, [{ from: p.a, to: mid }, { from: mid, to: end }]);
    }

    case 'compare': {
      const split = (n: number): { tens: number; ones: number } => ({ tens: Math.floor(n / 10), ones: n % 10 });
      return { kind: 'blocks', numbers: [split(p.left), split(p.right)] };
    }

    case 'place-value':
      return { kind: 'blocks', numbers: [{ tens: p.tens, ones: p.ones }] };

    case 'fraction':
      // Doubles: two equal rows. Fractions: a bar cut into equal parts.
      if (p.den === 1) return p.whole * 2 <= MAX_DOTS ? { kind: 'array', rows: 2, cols: p.whole } : line(p.whole, countHops(p.whole, p.whole));
      return { kind: 'fraction', whole: p.whole, num: p.num, den: p.den };

    case 'parity': {
      // Show the number that was just shot (or the right one). Big numbers: only the ones digit matters.
      const v = wrongValue ?? p.value;
      return { kind: 'pairs', value: v <= 20 ? v : v % 10 === 0 ? 10 : v % 10 };
    }
  }
}

/** The number a picture works out to, for checking pictures against answers in tests. */
export function pictureResult(pic: HintPicture): number | null {
  switch (pic.kind) {
    case 'numberline':
      return pic.hops.length ? pic.hops[pic.hops.length - 1].to : pic.start;
    case 'tenframe':
      return pic.ask === 'filled' ? pic.filled : pic.size - pic.filled;
    case 'bar': {
      const [x, y] = pic.parts;
      if (pic.whole === null) return x !== null && y !== null ? x + y : null;
      if (x === null && y !== null) return pic.whole - y;
      if (y === null && x !== null) return pic.whole - x;
      return null;
    }
    case 'array':
      return pic.rows * pic.cols;
    case 'share':
      return pic.total / pic.groups;
    case 'fraction':
      return (pic.whole * pic.num) / pic.den;
    default:
      return null;
  }
}
