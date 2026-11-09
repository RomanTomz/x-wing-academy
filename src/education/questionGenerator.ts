import { chooseDistractors, swapDigits } from './distractors';
import type { Rng } from './rng';
import { availableTopics, stageParams } from './stages';
import { COMPARE_SYMBOLS, type Problem, type Question, type StageParams, type TopicId } from './types';

const MINUS = '−';

export const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/** The part of a question produced by a topic generator, before options are chosen. */
interface Draft {
  topic: TopicId;
  problem: Problem;
  instruction: string;
  display: string;
  spoken: string;
  answer: number;
  strategy: string;
  mistakes: (number | null)[];
  near: (number | null)[];
  /** Upper bound for distractor values. */
  ceiling: number;
  /** The complete option set (including the answer), for topics with special options. */
  fixedOptions?: number[];
  /** How to show an option on a target (defaults to the number). */
  labelFor?: (n: number) => string;
  visual?: Question['visual'];
}

type TopicGenerator = (rng: Rng, p: StageParams) => Draft;

const near = (n: number, step = 1): number[] => [n + step, n - step, n + 2 * step, n - 2 * step];

function opWord(op: string): string {
  if (op === '+') return 'plus';
  if (op === '×') return 'times';
  if (op === '÷') return 'divided by';
  return 'take away';
}

function opSymbol(op: string): string {
  return op === '-' ? MINUS : op;
}

const recognition: TopicGenerator = (rng, p) => {
  const value = rng.int(p.stage === 0 ? 1 : 2, Math.min(20, p.max + 6));
  const word = NUMBER_WORDS[value];
  const lookAlikes: (number | null)[] = [swapDigits(value), value === 6 ? 9 : value === 9 ? 6 : null, value + 10, value - 10];
  return {
    topic: 'recognition',
    problem: { kind: 'recognition', value },
    instruction: 'Find the number',
    display: word,
    spoken: `Find the number ${word}`,
    answer: value,
    strategy: `${word} is written ${value}.`,
    mistakes: lookAlikes,
    near: near(value),
    ceiling: 20,
  };
};

function equationDraft(
  topic: TopicId,
  a: number,
  op: '+' | '-' | '×' | '÷',
  b: number,
  missing: 'a' | 'b' | 'result',
  instruction: string,
  strategy: string,
  mistakes: (number | null)[],
  ceiling: number,
): Draft {
  const result = op === '+' ? a + b : op === '-' ? a - b : op === '÷' ? a / b : a * b;
  const answer = missing === 'a' ? a : missing === 'b' ? b : result;
  const show = (part: 'a' | 'b' | 'result', v: number): string => (missing === part ? '?' : String(v));
  const say = (part: 'a' | 'b' | 'result', v: number): string => (missing === part ? 'what' : String(v));
  const display = `${show('a', a)} ${opSymbol(op)} ${show('b', b)} = ${show('result', result)}`;
  const spoken =
    missing === 'result'
      ? `What is ${a} ${opWord(op)} ${b}?`
      : `${say('a', a)} ${opWord(op)} ${say('b', b)} makes ${result}?`;
  return {
    topic,
    problem: { kind: 'equation', a, op, b, result, missing },
    instruction,
    display,
    spoken,
    answer,
    strategy,
    mistakes,
    near: near(answer),
    ceiling,
  };
}

const addition: TopicGenerator = (rng, p) => {
  let a: number;
  let b: number;
  if (p.tier === 3) {
    const sum = rng.int(Math.max(20, Math.floor(p.max * 0.5)), p.max);
    b = rng.int(3, Math.min(40, sum - 10));
    a = sum - b;
  } else {
    const sum = rng.int(p.tier === 1 ? 2 : 8, p.max);
    a = rng.int(1, sum - 1);
    b = sum - a;
  }
  // Put the bigger number first more often — it is the easier way to count on.
  if (b > a && rng.chance(0.6)) [a, b] = [b, a];
  const sum = a + b;
  const strategy =
    sum >= 20 ? `Add the tens, then the ones: ${a} + ${b}.` : `Start at ${Math.max(a, b)} and count on ${Math.min(a, b)} more.`;
  return equationDraft(
    'addition', a, '+', b, 'result', 'What is…', strategy,
    [Math.abs(a - b), sum + 10, sum - 10, swapDigits(sum)],
    p.max + 10,
  );
};

const subtraction: TopicGenerator = (rng, p) => {
  let a: number;
  let b: number;
  if (p.tier === 3) {
    a = rng.int(Math.max(20, Math.floor(p.max * 0.5)), p.max);
    b = rng.int(3, Math.min(a - 2, 40));
  } else {
    a = rng.int(p.tier === 1 ? 2 : 10, p.max);
    b = rng.int(1, a - 1);
  }
  const diff = a - b;
  // "Take the smaller digit from the bigger" error, e.g. 42 − 17 → 35.
  const digitSlip =
    a >= 10 && b >= 10 && a % 10 < b % 10
      ? (Math.floor(a / 10) - Math.floor(b / 10)) * 10 + (b % 10) - (a % 10)
      : null;
  const strategy = b <= 10 ? `Start at ${a} and count back ${b}.` : `Count up from ${b} to ${a}.`;
  return equationDraft(
    'subtraction', a, '-', b, 'result', 'What is…', strategy,
    [a + b, diff + 10, diff - 10, digitSlip],
    p.max + 10,
  );
};

const numberBonds: TopicGenerator = (rng, p) => {
  const target = rng.pick(p.bondTargets);
  if (target === 100) {
    // Bonds to 100 using tens (Year 2), or fives at the top stage.
    const step = p.stage >= 8 && rng.chance(0.5) ? 5 : 10;
    const a = rng.int(1, 100 / step - 1) * step;
    const answer = 100 - a;
    const draft = equationDraft(
      'number-bonds', a, '+', answer, 'b', 'Make 100!',
      `Count on in tens from ${a} until you reach 100.`,
      [a, answer + 10, answer - 10, step === 5 ? answer + 5 : null],
      110,
    );
    draft.near = near(answer, step);
    return draft;
  }
  const a = rng.int(1, target - 1);
  const answer = target - a;
  return equationDraft(
    'number-bonds', a, '+', answer, 'b', `Make ${target}!`,
    `Count on from ${a} until you reach ${target}.`,
    // Common slips: repeating the number shown, or adding instead of finding the gap.
    [a, target + a, answer + 10],
    target + 10,
  );
};

const missingNumber: TopicGenerator = (rng, p) => {
  const form = rng.int(0, 2);
  const lo = Math.max(3, Math.floor(p.max / 2));
  if (form === 0) {
    // ? + b = c
    const c = rng.int(lo, p.max);
    const b = rng.int(1, c - 1);
    const a = c - b;
    return equationDraft('missing-number', a, '+', b, 'a', 'Find the missing number',
      `What do you add to ${b} to make ${c}?`, [c + b, a + 10, a - 10], p.max + 10);
  }
  if (form === 1) {
    // a − ? = c
    const a = rng.int(lo, p.max);
    const b = rng.int(1, a - 1);
    const c = a - b;
    return equationDraft('missing-number', a, '-', b, 'b', 'Find the missing number',
      `Count back from ${a} until you reach ${c}.`, [a + c, c, b + 10], p.max + 10);
  }
  // ? − b = c
  const a = rng.int(lo, p.max);
  const b = rng.int(1, a - 1);
  const c = a - b;
  return equationDraft('missing-number', a, '-', b, 'a', 'Find the missing number',
    `Add them back together: ${c} + ${b}.`, [c - b, b, a + 10], p.max + 10);
};

/** Counting steps and the highest number reached, by tier. */
export function countingRules(tier: 1 | 2 | 3): { steps: number[]; limit: (step: number) => number; backwards: boolean } {
  if (tier === 1) return { steps: [1, 2, 10], limit: (s) => (s === 10 ? 100 : 20), backwards: false };
  if (tier === 2) return { steps: [2, 5, 10], limit: (s) => (s === 10 ? 100 : 50), backwards: false };
  return { steps: [2, 3, 5, 10], limit: () => 100, backwards: true };
}

const counting: TopicGenerator = (rng, p) => {
  const rules = countingRules(p.tier);
  const step = rng.pick(rules.steps);
  const limit = rules.limit(step);
  // Multiples of the step (Year 2 style), or any start when counting in 1s.
  const unit = step === 1 ? 1 : step;
  const maxStartK = Math.max(0, Math.floor(limit / unit) - 3);
  // Counting in 1s starts from a bigger number so it's not trivial (and often crosses a ten).
  const k = rng.int(step === 1 ? 5 : 0, maxStartK);
  const forward = !rules.backwards || rng.chance(0.6);
  const start = forward ? k * unit : (k + 3) * unit;
  const signed = forward ? step : -step;
  const terms = [start, start + signed, start + 2 * signed];
  const answer = start + 3 * signed;
  const word = step === 1 ? '1s' : `${step}s`;
  const dir = forward ? '' : ' backwards';
  return {
    topic: 'counting',
    problem: { kind: 'sequence', terms, step: signed },
    instruction: `Count in ${word}${dir}!`,
    display: `${terms.join(', ')}, ?`,
    spoken: `Count in ${word}${dir}. ${terms.join(', ')}, what comes next?`,
    answer,
    strategy: forward ? `Each jump is ${step}. What is ${terms[2]} + ${step}?` : `Each jump goes back ${step}. What is ${terms[2]} − ${step}?`,
    // Common slips: off by one, skipping a jump, or a ten out. Never a number already shown.
    mistakes: [answer + 1, answer - 1, answer + signed, step === 10 ? null : answer + 10].filter((m) => !terms.includes(m as number)),
    near: [answer + signed, answer + 2 * signed, answer - 2, answer + 2].filter((m) => !terms.includes(m)),
    ceiling: limit + 2 * step,
  };
};

const multiplication: TopicGenerator = (rng, p) => {
  const table = rng.pick(p.tables.length > 0 ? p.tables : [2, 5, 10]);
  const factor = rng.int(2, Math.max(2, p.maxFactor));
  const [a, b] = rng.chance(0.5) ? [factor, table] : [table, factor];
  const answer = a * b;
  return equationDraft(
    'multiplication', a, '×', b, 'result', 'What is…',
    `Count in ${table}s, ${factor} times.`,
    [table * (factor + 1), table * (factor - 1), a + b, answer + 1, answer - 1],
    table * (p.maxFactor + 2),
  );
};

const twoStep: TopicGenerator = (rng, p) => {
  const limit = Math.min(p.max, 40);
  const a = rng.int(5, Math.floor(limit / 2));
  const b = rng.int(2, 10);
  const op2: '+' | '-' = rng.chance(0.5) ? '+' : '-';
  const c = op2 === '+' ? rng.int(1, Math.max(1, limit - a - b)) : rng.int(1, a + b - 1);
  const first = a + b;
  const answer = op2 === '+' ? first + c : first - c;
  const opposite = op2 === '+' ? first - c : first + c;
  return {
    topic: 'two-step',
    problem: { kind: 'two-step', a, op1: '+', b, op2, c },
    instruction: 'Two steps!',
    display: `${a} + ${b} ${opSymbol(op2)} ${c} = ?`,
    spoken: `What is ${a} plus ${b} ${opWord(op2)} ${c}?`,
    answer,
    strategy: `First do ${a} + ${b} = ${first}. Then ${op2 === '+' ? 'add' : 'take away'} ${c}.`,
    mistakes: [first, opposite, answer + 10, answer - 10],
    near: near(answer),
    ceiling: limit + 20,
  };
};

// ---------------------------------------------------------------- Boss topics

/**
 * Multiplication and division facts for the 2, 5 and 10 times tables (Year 2).
 * Cadet: ×2 and ×10. Pilot: all three tables with ÷. Ace: missing factors too.
 */
const timesDivide: TopicGenerator = (rng, p) => {
  const tables = p.tier === 1 ? [2, 10] : [2, 5, 10];
  const t = rng.pick(tables);
  const f = rng.int(p.tier === 1 ? 1 : 2, p.tier === 3 ? 12 : 10);
  const product = t * f;
  const forms = p.tier === 1 ? ['times'] : p.tier === 2 ? ['times', 'divide', 'divide'] : ['divide', 'missing', 'missing', 'groups'];
  const form = rng.pick(forms);
  // Neighbouring multiples (one group too many / few) are the classic slip, plus adding instead.
  const timesMistakes = [t * (f + 1), t * (f - 1), t + f];
  if (form === 'times') {
    const [a, b] = rng.chance(0.5) ? [f, t] : [t, f];
    return equationDraft('times-divide', a, '×', b, 'result', 'What is…', `Count in ${t}s, ${f} times.`, timesMistakes, t * 13);
  }
  if (form === 'divide') {
    return equationDraft(
      'times-divide', product, '÷', t, 'result', 'Share it out!',
      `How many ${t}s make ${product}? Count in ${t}s until you reach ${product}.`,
      [f + 1, f - 1, product - t, t],
      t * 13,
    );
  }
  if (form === 'missing') {
    const [a, b, missing] = rng.chance(0.5) ? [f, t, 'a' as const] : [t, f, 'b' as const];
    return equationDraft('times-divide', a, '×', b, missing, 'Find the missing number', `Count in ${t}s until you reach ${product}.`, [f + 1, f - 1, product], t * 13);
  }
  // "How many 5s make 30?" — division as grouping.
  return {
    ...equationDraft('times-divide', product, '÷', t, 'result', 'Make groups!', `Count in ${t}s until you reach ${product}.`, [f + 1, f - 1, product - t], t * 13),
    display: `How many ${t}s in ${product}?`,
    spoken: `How many ${t}s make ${product}?`,
  };
};

// ---------------------------------------------------------------- TIE Academy topics

/** Largest number used by the TIE Academy topics at each level. */
export const TIE_LIMITS = { 1: 20, 2: 50, 3: 100 } as const;

const compare: TopicGenerator = (rng, p) => {
  const limit = TIE_LIMITS[p.tier];
  let left: number;
  let right: number;
  let leftText: string | null = null;
  const roll = rng.next();
  if (roll < 0.2) {
    left = rng.int(1, limit);
    right = left;
  } else if (p.tier >= 2 && roll < 0.5) {
    // Reversed digits (e.g. 47 vs 74) — the classic place-value trap.
    const maxTens = Math.min(9, Math.floor((limit - 1) / 10));
    const t = rng.int(1, maxTens);
    let o = rng.int(1, maxTens);
    if (o === t) o = t === 1 ? 2 : t - 1;
    left = t * 10 + o;
    right = o * 10 + t;
  } else {
    left = rng.int(0, limit);
    const gap = rng.int(1, p.tier === 1 ? 5 : 10);
    right = rng.chance(0.5) ? Math.min(limit, left + gap) : Math.max(0, left - gap);
    if (right === left) right = left === 0 ? 1 : left - 1;
  }
  if (p.tier === 3 && left >= 11 && left % 10 !== 0 && rng.chance(0.35)) {
    leftText = `${Math.floor(left / 10) * 10} + ${left % 10}`;
  }
  if (!leftText && rng.chance(0.5)) [left, right] = [right, left];
  const answer = left < right ? 0 : left === right ? 1 : 2;
  const shownLeft = leftText ?? String(left);
  const word = ['is less than', 'equals', 'is greater than'][answer];
  return {
    topic: 'compare',
    problem: { kind: 'compare', left, right },
    instruction: 'Which sign goes in the gap?',
    display: `${shownLeft}  ?  ${right}`,
    spoken: `Which sign goes between ${shownLeft} and ${right}? Less than, greater than, or equals?`,
    answer,
    strategy: `${shownLeft} ${word} ${right}, so it's ${COMPARE_SYMBOLS[answer]}. The open mouth eats the bigger number!`,
    mistakes: [],
    near: [],
    ceiling: 2,
    fixedOptions: [0, 1, 2],
    labelFor: (n) => COMPARE_SYMBOLS[n] ?? '?',
  };
};

const placeValue: TopicGenerator = (rng, p) => {
  const tens = p.tier === 1 ? 1 : rng.int(1, p.tier === 2 ? 4 : 9);
  const ones = p.tier === 3 ? rng.int(1, 9) : rng.int(0, 9);
  const n = tens * 10 + ones;
  const s = (k: number): string => (k === 1 ? '' : 's');
  const forms =
    p.tier === 1
      ? (['blocks', 'words'] as const)
      : p.tier === 2
        ? (['blocks', 'words', 'tens-digit'] as const)
        : (['partition', 'missing-ones', 'missing-tens', 'tens-digit', 'blocks'] as const);
  const form = rng.pick<string>(forms);
  const base = { topic: 'place-value' as const, ceiling: 110 };
  const numberMistakes = [swapDigits(n), tens + ones, n + 10, n - 10];
  switch (form) {
    case 'blocks':
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'number' },
        instruction: 'How many blocks?',
        display: '',
        spoken: 'How many blocks? Count the tens, then the ones.',
        answer: n,
        strategy: `${tens} ten${s(tens)} is ${tens * 10}, and ${ones} more makes ${n}.`,
        mistakes: numberMistakes,
        near: [n + 1, n - 1, n + 2],
        visual: { kind: 'blocks', tens, ones },
      };
    case 'words':
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'number' },
        instruction: 'What number is…',
        display: `${tens} ten${s(tens)} and ${ones} one${s(ones)}`,
        spoken: `What number is ${tens} ten${s(tens)} and ${ones} one${s(ones)}?`,
        answer: n,
        strategy: `${tens} ten${s(tens)} is ${tens * 10}. Add ${ones} more.`,
        mistakes: numberMistakes,
        near: [n + 1, n - 1, n + 2],
      };
    case 'tens-digit':
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'tens' },
        instruction: 'How many TENS in…',
        display: `${n}`,
        spoken: `How many tens are in ${n}?`,
        answer: tens,
        strategy: `In ${n}, the first digit tells you the tens: ${tens}.`,
        mistakes: [ones, tens * 10, n],
        near: [tens + 1, tens - 1],
      };
    case 'partition':
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'number' },
        instruction: 'What is…',
        display: `${tens * 10} + ${ones} = ?`,
        spoken: `What is ${tens * 10} plus ${ones}?`,
        answer: n,
        strategy: `${tens * 10} and ${ones} ones make ${n}.`,
        mistakes: numberMistakes,
        near: [n + 1, n - 1],
      };
    case 'missing-ones':
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'ones' },
        instruction: 'Split it into tens and ones',
        display: `${n} = ${tens * 10} + ?`,
        spoken: `${n} equals ${tens * 10} plus what?`,
        answer: ones,
        strategy: `The last digit of ${n} shows the ones.`,
        mistakes: [tens, ones + 10, n],
        near: [ones + 1, ones - 1],
      };
    default:
      return {
        ...base,
        problem: { kind: 'place-value', tens, ones, ask: 'tens-value' },
        instruction: 'Split it into tens and ones',
        display: `${n} = ? + ${ones}`,
        spoken: `${n} equals what, plus ${ones}?`,
        answer: tens * 10,
        strategy: `${tens} tens are worth ${tens * 10}.`,
        mistakes: [tens, (tens + 1) * 10, ones * 10],
        near: [tens * 10 + 10, tens * 10 - 10],
      };
  }
};

const FRACTION_GLYPH: Record<string, string> = { '1/2': '½', '1/4': '¼', '3/4': '¾', '1/3': '⅓' };
const FRACTION_WORDS: Record<string, string> = { '1/2': 'half', '1/4': 'a quarter', '3/4': 'three quarters', '1/3': 'a third' };

const fractions: TopicGenerator = (rng, p) => {
  type Kind = 'double' | '1/2' | '1/4' | '3/4' | '1/3';
  const kinds: Kind[] = p.tier === 1 ? ['double', '1/2'] : p.tier === 2 ? ['double', '1/2', '1/4'] : ['1/2', '1/4', '3/4', '1/3'];
  const kind = rng.pick(kinds);
  if (kind === 'double') {
    const n = rng.int(p.tier === 1 ? 1 : 5, p.tier === 1 ? 10 : 20);
    const answer = n * 2;
    return {
      topic: 'fractions',
      problem: { kind: 'fraction', whole: n, num: 2, den: 1 },
      instruction: 'What is…',
      display: `double ${n} = ?`,
      spoken: `What is double ${n}?`,
      answer,
      strategy: `Double means add it twice: ${n} + ${n}.`,
      mistakes: [n, n + 2, answer + 10],
      near: [answer + 1, answer - 1, answer + 2],
      ceiling: 50,
    };
  }
  const [num, den] = kind.split('/').map(Number);
  const maxWhole = { '1/2': p.tier === 1 ? 20 : p.tier === 2 ? 40 : 100, '1/4': p.tier === 2 ? 20 : 40, '3/4': 24, '1/3': 30 }[kind];
  // Halves of big numbers stay friendly: tens or small even numbers.
  let whole = rng.int(1, Math.floor(maxWhole / den)) * den;
  if (kind === '1/2' && whole > 40 && whole % 10 !== 0) whole = Math.round(whole / 10) * 10;
  const answer = (whole * num) / den;
  const part = whole / den;
  const strategies: Record<string, string> = {
    '1/2': `Share ${whole} into 2 equal groups.`,
    '1/4': `Halve ${whole}, then halve again.`,
    '3/4': `A quarter of ${whole} is ${part}. Three quarters is 3 lots of ${part}.`,
    '1/3': `Share ${whole} into 3 equal groups.`,
  };
  return {
    topic: 'fractions',
    problem: { kind: 'fraction', whole, num, den },
    instruction: 'What is…',
    display: `${FRACTION_GLYPH[kind]} of ${whole} = ?`,
    spoken: `What is ${FRACTION_WORDS[kind]} of ${whole}?`,
    answer,
    strategy: strategies[kind],
    // Common slips: the whole amount, halving instead, or just one part.
    mistakes: [whole, whole % 2 === 0 ? whole / 2 : null, part, whole * 2],
    near: [answer + 1, answer - 1, answer + 2],
    ceiling: 110,
  };
};

const oddEven: TopicGenerator = (rng, p) => {
  const limit = TIE_LIMITS[p.tier];
  const want: 'even' | 'odd' = rng.chance(0.5) ? 'even' : 'odd';
  let value = rng.int(2, limit - 2);
  if ((value % 2 === 0) !== (want === 'even')) value += 1;
  const others = rng
    .shuffle([value + 1, value - 1, value + 3, value - 3, value + 5, value - 5])
    .filter((v) => v >= 0 && v <= limit)
    .slice(0, 2);
  return {
    topic: 'odd-even',
    problem: { kind: 'parity', want, value },
    instruction: 'Shoot the…',
    display: `${want.toUpperCase()} number!`,
    spoken: `Which number is ${want}?`,
    answer: value,
    strategy: 'Even numbers end in 0, 2, 4, 6 or 8. Odd numbers end in 1, 3, 5, 7 or 9.',
    mistakes: [],
    near: [],
    ceiling: limit,
    fixedOptions: [value, ...others],
  };
};

const GENERATORS: Record<TopicId, TopicGenerator> = {
  'times-divide': timesDivide,
  compare,
  'place-value': placeValue,
  fractions,
  'odd-even': oddEven,
  recognition,
  addition,
  subtraction,
  'number-bonds': numberBonds,
  'missing-number': missingNumber,
  counting,
  multiplication,
  'two-step': twoStep,
};

/** Recompute the correct answer purely from the structured problem. */
export function solveProblem(problem: Problem): number {
  switch (problem.kind) {
    case 'recognition':
      return problem.value;
    case 'equation':
      return problem.missing === 'a' ? problem.a : problem.missing === 'b' ? problem.b : problem.result;
    case 'sequence':
      return problem.terms[problem.terms.length - 1] + problem.step;
    case 'two-step': {
      const first = problem.op1 === '+' ? problem.a + problem.b : problem.a - problem.b;
      return problem.op2 === '+' ? first + problem.c : first - problem.c;
    }
    case 'compare':
      return problem.left < problem.right ? 0 : problem.left === problem.right ? 1 : 2;
    case 'place-value': {
      const n = problem.tens * 10 + problem.ones;
      return problem.ask === 'number' ? n : problem.ask === 'tens' ? problem.tens : problem.ask === 'ones' ? problem.ones : problem.tens * 10;
    }
    case 'fraction':
      return (problem.whole * problem.num) / problem.den;
    case 'parity':
      return problem.value;
  }
}

/** True if the question is internally consistent and answerable. */
export function isValidQuestion(q: Question): boolean {
  if (q.options.length !== 3) return false;
  if (new Set(q.options).size !== 3) return false;
  if (q.options.filter((o) => o === q.answer).length !== 1) return false;
  if (q.options.some((o) => !Number.isInteger(o) || o < 0)) return false;
  if (solveProblem(q.problem) !== q.answer) return false;
  if (q.optionLabels.length !== 3 || new Set(q.optionLabels).size !== 3) return false;
  if (q.problem.kind === 'compare' && [...q.options].sort().join() !== '0,1,2') return false;
  if (q.problem.kind === 'parity') {
    const isWanted = (n: number): boolean => (n % 2 === 0) === (q.problem.kind === 'parity' && q.problem.want === 'even');
    if (q.options.filter(isWanted).length !== 1 || !isWanted(q.answer)) return false;
  }
  if (q.problem.kind === 'fraction' && !Number.isInteger(q.answer)) return false;
  if (q.problem.kind === 'equation') {
    const { a, op, b, result } = q.problem;
    const computed = op === '+' ? a + b : op === '-' ? a - b : op === '÷' ? a / b : a * b;
    if (computed !== result || !Number.isInteger(result) || a < 0 || b < 0 || result < 0) return false;
  }
  return true;
}

export interface GenerateOptions {
  stage: number;
  enabledTopics: Readonly<Record<TopicId, boolean>>;
  rng: Rng;
  /** Displays shown recently, to avoid immediate repeats. */
  recentDisplays?: readonly string[];
  /** Topic used for the previous question, to encourage variety. */
  previousTopic?: TopicId;
  /** Force a topic (mainly for tests). */
  topic?: TopicId;
  /** Draw only from these topics, ignoring tier availability and parent toggles (campaign planets). */
  topicPool?: readonly TopicId[];
}

let nextId = 1;

export function generateQuestion(opts: GenerateOptions): Question {
  const params = stageParams(opts.stage);
  const topics = opts.topicPool && opts.topicPool.length > 0 ? [...opts.topicPool] : availableTopics(params.tier, opts.enabledTopics);
  const recent = new Set(opts.recentDisplays ?? []);

  let best: Question | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    let topic = opts.topic ?? opts.rng.pick(topics);
    if (!opts.topic && topic === opts.previousTopic && topics.length > 1 && attempt < 4) {
      topic = opts.rng.pick(topics.filter((t) => t !== opts.previousTopic));
    }
    const draft = GENERATORS[topic](opts.rng, params);
    const distractors = draft.fixedOptions
      ? draft.fixedOptions.filter((o) => o !== draft.answer)
      : chooseDistractors(draft.answer, draft.mistakes, draft.near, opts.rng, {
          min: 0,
          max: Math.max(draft.ceiling, draft.answer + 5),
          count: 2,
        });
    const options = opts.rng.shuffle([draft.answer, ...distractors]);
    const question: Question = {
      id: nextId++,
      topic: draft.topic,
      stage: params.stage,
      problem: draft.problem,
      instruction: draft.instruction,
      display: draft.display,
      spoken: draft.spoken,
      answer: draft.answer,
      options,
      optionLabels: options.map(draft.labelFor ?? String),
      ...(draft.visual ? { visual: draft.visual } : {}),
      strategy: draft.strategy,
    };
    if (!isValidQuestion(question)) continue;
    best = question;
    if (!recent.has(question.display)) break;
  }
  return best ?? fallbackQuestion(params.stage);
}

/** A guaranteed-valid question used if generation ever fails. */
export function fallbackQuestion(stage: number): Question {
  return {
    id: nextId++,
    topic: 'addition',
    stage,
    problem: { kind: 'equation', a: 2, op: '+', b: 3, result: 5, missing: 'result' },
    instruction: 'What is…',
    display: '2 + 3 = ?',
    spoken: 'What is 2 plus 3?',
    answer: 5,
    options: [4, 5, 6],
    optionLabels: ['4', '5', '6'],
    strategy: 'Start at 3 and count on 2 more.',
  };
}

/** A gentle hint after a wrong answer. Never scolds. */
export function hintFor(q: Question, wrongValue: number, wrongCount: number): string {
  if (wrongCount >= 2) return q.strategy;
  if (q.topic === 'compare') return 'Shields up! The open mouth always eats the BIGGER number.';
  if (q.topic === 'odd-even') return 'Shields up! Even numbers end in 0, 2, 4, 6 or 8.';
  if (q.topic === 'recognition') return `That was ${wrongValue}. Look for ${q.display}!`;
  if (wrongValue > q.answer) return 'Shields up! That one is too big. Try a smaller number.';
  return 'Shields up! That one is too small. Try a bigger number.';
}
