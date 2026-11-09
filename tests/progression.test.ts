import { describe, expect, it } from 'vitest';
import { interludeSchedule, Mission } from '../src/progression/mission';
import { newlyUnlocked, nextUnlock, UNLOCKS } from '../src/progression/unlocks';
import { missionXp, rankForXp, RANKS, XP } from '../src/progression/xp';

function playMission(m: Mission, wrongBefore: (n: number) => number = () => 0) {
  const steps: string[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const step = m.advance();
    if (step.type === 'complete') {
      steps.push('complete');
      break;
    }
    if (step.type === 'interlude') {
      steps.push(`interlude:${step.kind}`);
      m.collectCrystal();
      continue;
    }
    steps.push(`q${step.number}`);
    for (let i = 0; i < wrongBefore(step.number); i++) m.recordAttempt(false);
    m.recordAttempt(true);
  }
  return steps;
}

describe('mission flow', () => {
  it('runs 10 questions with two interludes and then completes', () => {
    const m = new Mission(10);
    const steps = playMission(m);
    expect(steps.filter((s) => s.startsWith('q'))).toHaveLength(10);
    expect(steps.filter((s) => s.startsWith('interlude'))).toEqual(['interlude:crystals', 'interlude:asteroids']);
    expect(steps.at(-1)).toBe('complete');
    expect(m.isComplete).toBe(true);
  });

  it('interlude schedule fits each mission length', () => {
    expect(interludeSchedule(5)).toEqual([3]);
    expect(interludeSchedule(10)).toEqual([3, 7]);
    expect(interludeSchedule(15)).toEqual([4, 8, 11]);
  });

  it('a wrong answer keeps the question open and costs nothing', () => {
    const m = new Mission(5);
    m.advance();
    expect(m.recordAttempt(false)).toEqual({ kind: 'incorrect', wrongCount: 1 });
    expect(m.isQuestionOpen).toBe(true);
    expect(m.advance()).toEqual({ type: 'question', number: 1 });
    const r = m.recordAttempt(true);
    expect(r).toEqual({ kind: 'correct', firstTry: false, xp: XP.correctAnswer });
  });

  it('ignores duplicate hits after the question is resolved', () => {
    const m = new Mission(5);
    m.advance();
    m.recordAttempt(true);
    expect(m.recordAttempt(true)).toEqual({ kind: 'ignored' });
    expect(m.recordAttempt(false)).toEqual({ kind: 'ignored' });
    expect(m.getStats().questionsCompleted).toBe(1);
  });

  it('reports accuracy and XP', () => {
    const m = new Mission(10);
    playMission(m, (n) => (n % 2 === 0 ? 1 : 0));
    const s = m.getStats();
    expect(s.questionsCompleted).toBe(10);
    expect(s.firstTryCorrect).toBe(5);
    expect(s.accuracy).toBeCloseTo(0.5);
    expect(s.totalAttempts).toBe(15);
    expect(s.crystals).toBe(2);
    expect(s.xpEarned).toBe(10 * XP.correctAnswer + 2 * XP.crystal + XP.missionComplete);
  });

  it('mistakes never reduce XP', () => {
    const perfect = new Mission(5);
    playMission(perfect);
    const messy = new Mission(5);
    playMission(messy, () => 2);
    expect(messy.getStats().xpEarned).toBe(perfect.getStats().xpEarned);
  });

  it('fresh missions start clean', () => {
    const a = new Mission(5);
    playMission(a);
    const b = new Mission(5);
    expect(b.getStats().questionsCompleted).toBe(0);
    expect(b.currentQuestion).toBe(0);
  });
});

describe('XP and ranks', () => {
  it('computes mission XP', () => {
    expect(missionXp({ correctAnswers: 10, crystals: 5, asteroids: 4, completed: true })).toBe(1000 + 50 + 20 + 200);
    expect(missionXp({ correctAnswers: -3, crystals: 0, asteroids: 0, completed: false })).toBe(0);
  });

  it('maps XP to ranks with progress', () => {
    expect(rankForXp(0).rank.name).toBe('Recruit');
    expect(rankForXp(999).rank.name).toBe('Recruit');
    expect(rankForXp(1000).rank.name).toBe('Wingmate');
    expect(rankForXp(1750).progress).toBeCloseTo(0.5);
    const top = rankForXp(1e9);
    expect(top.rank).toBe(RANKS.at(-1));
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
    expect(rankForXp(Number.NaN).rank.name).toBe('Recruit');
  });

  it('a typical mission earns a rank after the first mission', () => {
    const typical = missionXp({ correctAnswers: 10, crystals: 8, asteroids: 3, completed: true });
    expect(rankForXp(typical).index).toBeGreaterThanOrEqual(1);
  });
});

describe('unlocks', () => {
  it('one new reward per mission for the first ten missions', () => {
    for (let m = 1; m <= 10; m++) expect(newlyUnlocked(m - 1, m)).toHaveLength(1);
    expect(newlyUnlocked(10, 11)).toHaveLength(0);
  });

  it('unlock ids are unique and starters are free', () => {
    expect(new Set(UNLOCKS.map((u) => u.id)).size).toBe(UNLOCKS.length);
    expect(UNLOCKS.filter((u) => u.missions === 0 && !u.boss).map((u) => u.kind).sort()).toEqual(['laser', 'paint', 'ship', 'ship', 'ship', 'trail']);
  });

  it('first mission unlocks the droid buddy', () => {
    expect(newlyUnlocked(0, 1)[0].kind).toBe('droid');
    expect(nextUnlock(0)?.id).toBe('droid-bip');
    expect(nextUnlock(10)).toBeNull();
  });
});
