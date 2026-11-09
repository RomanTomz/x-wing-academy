export type Tier = 1 | 2 | 3;

export type TopicId =
  | 'recognition'
  | 'addition'
  | 'subtraction'
  | 'number-bonds'
  | 'missing-number'
  | 'counting'
  | 'multiplication'
  | 'two-step'
  // TIE Academy topics.
  | 'compare'
  | 'place-value'
  | 'fractions'
  | 'odd-even';

export type Operator = '+' | '-' | '×';

/** Structured description of a problem, so correctness can be re-verified independently of display text. */
export type Problem =
  | { kind: 'recognition'; value: number }
  | {
      kind: 'equation';
      a: number;
      op: Operator;
      b: number;
      result: number;
      /** Which part of `a op b = result` is hidden. */
      missing: 'a' | 'b' | 'result';
    }
  | { kind: 'sequence'; terms: number[]; step: number }
  | { kind: 'two-step'; a: number; op1: '+' | '-'; b: number; op2: '+' | '-'; c: number }
  /** Answer is a comparison code: 0 = "<", 1 = "=", 2 = ">". `left` may be shown as an expression. */
  | { kind: 'compare'; left: number; right: number }
  /** Tens and ones. `ask` says which part is hidden. */
  | { kind: 'place-value'; tens: number; ones: number; ask: 'number' | 'tens' | 'ones' | 'tens-value' }
  /** `num/den` of `whole`, or double when den is 0.5 (num 1). */
  | { kind: 'fraction'; whole: number; num: number; den: number }
  | { kind: 'parity'; want: 'even' | 'odd'; value: number };

export const COMPARE_SYMBOLS = ['<', '=', '>'] as const;

export interface Question {
  id: number;
  topic: TopicId;
  stage: number;
  problem: Problem;
  /** Short line shown above the big display, e.g. "What is…". */
  instruction: string;
  /** The big text, e.g. "7 + 5 = ?". */
  display: string;
  /** Text for speech synthesis. */
  spoken: string;
  answer: number;
  /** Exactly three unique options, one of which is the answer. */
  options: number[];
  /** Text shown on each target, aligned with `options` (numbers, or symbols for comparisons). */
  optionLabels: string[];
  /** Optional picture for the question panel (base-ten blocks). */
  visual?: { kind: 'blocks'; tens: number; ones: number };
  /** A friendly strategy tip used after repeated mistakes. */
  strategy: string;
}

export interface StageParams {
  stage: number;
  tier: Tier;
  /** Largest number that should appear as an answer or total. */
  max: number;
  bondTargets: number[];
  tables: number[];
  maxFactor: number;
}

export const TIER_NAMES: Record<Tier, string> = {
  1: 'Rookie',
  2: 'Pilot',
  3: 'Squadron Leader',
};

export const TOPIC_NAMES: Record<TopicId, string> = {
  recognition: 'Number recognition',
  addition: 'Addition',
  subtraction: 'Subtraction',
  'number-bonds': 'Number bonds',
  'missing-number': 'Missing numbers',
  counting: 'Counting in 2s, 5s & 10s',
  multiplication: 'Early multiplication',
  'two-step': 'Two-step problems',
  compare: 'Comparing numbers (< > =)',
  'place-value': 'Tens and ones',
  fractions: 'Halves, quarters, thirds & doubles',
  'odd-even': 'Odd and even',
};

export const ALL_TOPICS: readonly TopicId[] = [
  'recognition',
  'addition',
  'subtraction',
  'number-bonds',
  'missing-number',
  'counting',
  'multiplication',
  'two-step',
  'compare',
  'place-value',
  'fractions',
  'odd-even',
];
