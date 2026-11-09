import { missionXp, XP } from './xp';

export type InterludeKind = 'crystals' | 'asteroids';

export type MissionStep =
  | { type: 'question'; number: number }
  | { type: 'interlude'; kind: InterludeKind }
  | { type: 'complete' };

export type AttemptResult =
  | { kind: 'correct'; firstTry: boolean; xp: number }
  | { kind: 'incorrect'; wrongCount: number }
  | { kind: 'ignored' };

export interface MissionStats {
  totalQuestions: number;
  questionsCompleted: number;
  firstTryCorrect: number;
  totalAttempts: number;
  /** First-attempt accuracy, 0..1. */
  accuracy: number;
  crystals: number;
  asteroids: number;
  xpEarned: number;
}

export const MISSION_LENGTHS = [5, 10, 15] as const;
export type MissionLength = (typeof MISSION_LENGTHS)[number];

/** Which question numbers are followed by a short flying interlude. */
export function interludeSchedule(total: number): number[] {
  const count = Math.floor(total / 4);
  const result: number[] = [];
  for (let i = 1; i <= count; i++) {
    const after = Math.round((total * i) / (count + 1));
    if (after > 0 && after < total && !result.includes(after)) result.push(after);
  }
  return result;
}

/**
 * Pure mission state machine. The Phaser scene drives it; it owns no timers or visuals.
 *
 *   start → question 1 → (interlude) → question 2 → … → complete
 */
export class Mission {
  readonly totalQuestions: number;
  private readonly interludes: number[];
  private questionNumber = 0;
  private questionOpen = false;
  private wrongOnCurrent = 0;
  private interludesDone = 0;
  private pendingInterlude = false;
  private finished = false;
  private stats = { completed: 0, firstTry: 0, attempts: 0, crystals: 0, asteroids: 0 };

  constructor(totalQuestions: number) {
    this.totalQuestions = Math.max(1, Math.floor(totalQuestions));
    this.interludes = interludeSchedule(this.totalQuestions);
  }

  get currentQuestion(): number {
    return this.questionNumber;
  }

  get isQuestionOpen(): boolean {
    return this.questionOpen;
  }

  get isComplete(): boolean {
    return this.finished;
  }

  /** Move to whatever comes next. Calling while a question is still open is a no-op that repeats it. */
  advance(): MissionStep {
    if (this.finished) return { type: 'complete' };
    if (this.questionOpen) return { type: 'question', number: this.questionNumber };
    if (this.pendingInterlude) {
      this.pendingInterlude = false;
      const kind: InterludeKind = this.interludesDone % 2 === 0 ? 'crystals' : 'asteroids';
      this.interludesDone++;
      return { type: 'interlude', kind };
    }
    if (this.questionNumber >= this.totalQuestions) {
      this.finished = true;
      return { type: 'complete' };
    }
    this.questionNumber++;
    this.questionOpen = true;
    this.wrongOnCurrent = 0;
    return { type: 'question', number: this.questionNumber };
  }

  /** Record a hit on an answer. Only the first correct hit per question counts. */
  recordAttempt(correct: boolean): AttemptResult {
    if (!this.questionOpen || this.finished) return { kind: 'ignored' };
    this.stats.attempts++;
    if (!correct) {
      this.wrongOnCurrent++;
      return { kind: 'incorrect', wrongCount: this.wrongOnCurrent };
    }
    const firstTry = this.wrongOnCurrent === 0;
    this.questionOpen = false;
    this.stats.completed++;
    if (firstTry) this.stats.firstTry++;
    if (this.interludes.includes(this.questionNumber)) this.pendingInterlude = true;
    return { kind: 'correct', firstTry, xp: XP.correctAnswer };
  }

  collectCrystal(): number {
    this.stats.crystals++;
    return XP.crystal;
  }

  destroyAsteroid(): number {
    this.stats.asteroids++;
    return XP.asteroid;
  }

  getStats(): MissionStats {
    const { completed, firstTry, attempts, crystals, asteroids } = this.stats;
    return {
      totalQuestions: this.totalQuestions,
      questionsCompleted: completed,
      firstTryCorrect: firstTry,
      totalAttempts: attempts,
      accuracy: completed === 0 ? 0 : firstTry / completed,
      crystals,
      asteroids,
      xpEarned: missionXp({ correctAnswers: completed, crystals, asteroids, completed: this.finished }),
    };
  }
}
