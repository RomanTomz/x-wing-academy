import { describe, expect, it } from 'vitest';
import { GameStore, MemoryStorage, type StorageLike } from '../src/persistence/gameStore';
import { BACKUP_KEY, defaultSave, parseSave, SAVE_KEY, sanitizeSave } from '../src/persistence/saveData';
import { sanitizeSettings } from '../src/settings/settings';

describe('save data', () => {
  it('round-trips through storage', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    store.recordQuestion('addition', true, 1);
    store.completeMission(1300);
    store.updateSettings({ pilotName: 'Luke', missionLength: 5 });

    const reloaded = new GameStore(storage);
    expect(reloaded.data.profile.totalXp).toBe(1300);
    expect(reloaded.data.profile.missionsCompleted).toBe(1);
    expect(reloaded.data.stats.questionsAttempted).toBe(1);
    expect(reloaded.data.stats.byTopic.addition).toEqual({ attempted: 1, firstTryCorrect: 1 });
    expect(reloaded.settings.pilotName).toBe('Luke');
    expect(reloaded.settings.missionLength).toBe(5);
  });

  it('survives corrupted JSON by falling back to the backup', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    store.completeMission(500);
    store.completeMission(500); // backup now holds the first good save
    storage.setItem(SAVE_KEY, '{not json');
    const reloaded = new GameStore(storage);
    expect(reloaded.data.profile.missionsCompleted).toBeGreaterThanOrEqual(1);
  });

  it('survives garbage everywhere by using defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, 'garbage');
    storage.setItem(BACKUP_KEY, '"a string"');
    const store = new GameStore(storage);
    expect(store.data).toEqual(defaultSave());
  });

  it('sanitises wrong types and out-of-range values', () => {
    const s = sanitizeSave({
      profile: { totalXp: -50, missionsCompleted: 'lots', stage: 99, equipped: { paint: 'paint-gold', droid: true } },
      stats: { questionsAttempted: 3, firstTryCorrect: 10, byTopic: { addition: { attempted: 2, firstTryCorrect: 5 } } },
      settings: { musicVolume: 7, tier: 9, missionLength: 12, topics: { addition: false }, pilotName: '<script>' },
    });
    expect(s.profile.totalXp).toBe(0);
    expect(s.profile.missionsCompleted).toBe(0);
    expect(s.profile.stage).toBe(8);
    // Locked items cannot be equipped by editing storage.
    expect(s.profile.equipped.paint).toBe('paint-red');
    expect(s.profile.equipped.droid).toBe(false);
    expect(s.stats.firstTryCorrect).toBe(3);
    expect(s.stats.byTopic.addition.firstTryCorrect).toBe(2);
    expect(s.settings.musicVolume).toBe(1);
    expect(s.settings.tier).toBe(1);
    expect(s.settings.missionLength).toBe(10);
    expect(s.settings.topics.addition).toBe(false);
    expect(s.settings.topics.subtraction).toBe(true);
    expect(s.settings.pilotName).toBe('script');
  });

  it('parseSave returns null for unusable text', () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave('')).toBeNull();
    expect(parseSave('[1,2]')).toBeNull();
    expect(parseSave('{"profile":{}}')).not.toBeNull();
  });

  it('works when storage is unavailable or throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = new GameStore(throwing);
    expect(() => store.recordQuestion('addition', true, 1)).not.toThrow();
    expect(store.save()).toBe(false);
    expect(() => store.resetProgress()).not.toThrow();
    const none = new GameStore(null);
    expect(none.save()).toBe(false);
  });
});

describe('game store', () => {
  it('unlocks and auto-equips the droid after the first mission', () => {
    const store = new GameStore(new MemoryStorage());
    const result = store.completeMission(1200);
    expect(result.newUnlocks.map((u) => u.id)).toEqual(['droid-bip']);
    expect(result.rankUp).toBe(true);
    expect(store.data.profile.equipped.droid).toBe(true);
  });

  it('refuses to equip locked items', () => {
    const store = new GameStore(new MemoryStorage());
    expect(store.equip('paint-gold')).toBe(false);
    expect(store.equip('paint-red')).toBe(true);
    expect(store.equip('nonsense')).toBe(false);
  });

  it('choosing a tier starts at that tier, and locking keeps it there', () => {
    const store = new GameStore(new MemoryStorage());
    store.updateSettings({ tier: 3 });
    expect(store.data.profile.stage).toBe(6);
    store.updateSettings({ adaptive: false, tier: 2 });
    expect(store.data.profile.stage).toBe(3);
    for (let i = 0; i < 40; i++) store.recordQuestion('addition', true, 1);
    expect(store.data.profile.stage).toBe(5);
  });

  it('adaptive difficulty progresses and is saved between sessions', () => {
    const storage = new MemoryStorage();
    const store = new GameStore(storage);
    for (let i = 0; i < 5; i++) store.recordQuestion('addition', true, 1);
    expect(store.data.profile.stage).toBe(1);
    expect(new GameStore(storage).data.profile.stage).toBe(1);
    expect(store.data.stats.stageHistory).toHaveLength(1);
  });

  it('reset clears progress but keeps settings', () => {
    const store = new GameStore(new MemoryStorage());
    store.updateSettings({ pilotName: 'Rey' });
    store.completeMission(5000);
    store.recordQuestion('subtraction', false, 3);
    store.resetProgress();
    expect(store.data.profile.totalXp).toBe(0);
    expect(store.data.stats.questionsAttempted).toBe(0);
    expect(store.settings.pilotName).toBe('Rey');
  });

  it('caps the recent-results history', () => {
    const store = new GameStore(new MemoryStorage());
    for (let i = 0; i < 100; i++) store.recordQuestion('addition', i % 2 === 0, 1);
    expect(store.data.stats.recent.length).toBeLessThanOrEqual(30);
  });

  it('sanitizeSettings fills in defaults', () => {
    const s = sanitizeSettings(undefined);
    expect(s.pilotName).toBe('Nova');
    expect(s.missionLength).toBe(10);
  });
});
