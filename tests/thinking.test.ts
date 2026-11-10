import { describe, expect, it } from 'vitest';
import { Mission } from '../src/progression/mission';
import { mightBeGuessing, shieldsUp, THINK_WINDOWS } from '../src/progression/thinkTime';
import { missionXp, XP } from '../src/progression/xp';
import { defaultSettings, sanitizeSettings } from '../src/settings/settings';

describe('think time', () => {
  it('off never shields', () => {
    expect(shieldsUp('off', 0, false)).toBe(false);
  });

  it('shields stay up for the minimum, then until the question is read, up to the maximum', () => {
    const w = THINK_WINDOWS.short!;
    expect(shieldsUp('short', 0, true)).toBe(true);
    expect(shieldsUp('short', w.min - 1, true)).toBe(true);
    expect(shieldsUp('short', w.min, true)).toBe(false);
    expect(shieldsUp('short', w.min, false)).toBe(true);
    expect(shieldsUp('short', w.max, false)).toBe(false);
  });

  it('long gives more time than short', () => {
    expect(THINK_WINDOWS.long!.min).toBeGreaterThan(THINK_WINDOWS.short!.min);
    expect(shieldsUp('long', THINK_WINDOWS.short!.max, false)).toBe(true);
  });

  it('defaults to short and survives bad saved values', () => {
    expect(defaultSettings().thinkTime).toBe('short');
    expect(sanitizeSettings({ thinkTime: 'forever' }).thinkTime).toBe('short');
    expect(sanitizeSettings({ thinkTime: 'off' }).thinkTime).toBe('off');
  });
});

describe('sharpshooter bonus', () => {
  it('a first-shot hit earns a bonus on top; later hits still earn full XP', () => {
    const m = new Mission(2, { interludes: false });
    m.advance();
    const first = m.recordAttempt(true);
    expect(first).toEqual({ kind: 'correct', firstTry: true, xp: XP.correctAnswer + XP.sharpshooter });
    m.advance();
    m.recordAttempt(false);
    const second = m.recordAttempt(true);
    expect(second).toEqual({ kind: 'correct', firstTry: false, xp: XP.correctAnswer });
    m.advance();
    const stats = m.getStats();
    expect(stats.firstTryLog).toEqual([true, false]);
    expect(stats.xpEarned).toBe(2 * XP.correctAnswer + XP.sharpshooter + XP.missionComplete);
  });

  it('mission XP adds the bonus per first-shot hit', () => {
    const base = missionXp({ correctAnswers: 10, crystals: 0, asteroids: 0, completed: true });
    expect(missionXp({ correctAnswers: 10, firstTry: 4, crystals: 0, asteroids: 0, completed: true })).toBe(base + 4 * XP.sharpshooter);
  });
});

describe('guessing flag for parents', () => {
  it('needs enough questions and accuracy near chance', () => {
    expect(mightBeGuessing({ attempted: 9, firstTryCorrect: 0 })).toBe(false);
    expect(mightBeGuessing({ attempted: 12, firstTryCorrect: 4 })).toBe(true);
    expect(mightBeGuessing({ attempted: 12, firstTryCorrect: 8 })).toBe(false);
  });
});
