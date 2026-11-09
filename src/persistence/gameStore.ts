import { applyResult, boundsFor, clampToBounds, type DifficultyChange } from '../education/difficulty';
import { firstStageOfTier } from '../education/stages';
import type { TopicId } from '../education/types';
import { newlyUnlocked, isUnlocked, unlockById, type Unlock } from '../progression/unlocks';
import { isPlanetUnlocked, PLANETS, planetIndex, type Level, type Planet, type PlanetId } from '../progression/campaign';
import { rankForXp, type Rank } from '../progression/xp';
import { sanitizeSettings, type ParentSettings } from '../settings/settings';
import { BACKUP_KEY, defaultProfile, defaultSave, defaultStats, LIMITS, parseSave, SAVE_KEY, type SaveData } from './saveData';

/** The subset of the Web Storage API we use, so tests can pass an in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** Safely obtain localStorage (it can throw in private modes or sandboxed frames). */
export function browserStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__xwing_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface MissionResult {
  xpEarned: number;
  newUnlocks: Unlock[];
  rankBefore: Rank;
  rankAfter: Rank;
  rankUp: boolean;
  /** Campaign only: whether this cleared a level for the first time. */
  newStar: boolean;
  /** Campaign only: a planet opened up by this mission. */
  planetUnlocked: Planet | null;
}

export interface CampaignClear {
  planetId: PlanetId;
  level: Level;
}

/**
 * Owns all persistent state. Pure TypeScript (no Phaser) so it can be unit tested.
 * Every mutation saves immediately; failures to save never crash the game.
 */
export class GameStore {
  private state: SaveData;
  private readonly storage: StorageLike | null;
  private readonly now: () => number;

  constructor(storage: StorageLike | null, now: () => number = Date.now) {
    this.storage = storage;
    this.now = now;
    this.state = this.load();
  }

  get data(): Readonly<SaveData> {
    return this.state;
  }

  get settings(): Readonly<ParentSettings> {
    return this.state.settings;
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    let text: string | null = null;
    let backup: string | null = null;
    try {
      text = this.storage.getItem(SAVE_KEY);
      backup = this.storage.getItem(BACKUP_KEY);
    } catch {
      return defaultSave();
    }
    const loaded = parseSave(text) ?? parseSave(backup) ?? defaultSave();
    const bounds = boundsFor(loaded.settings.adaptive, loaded.settings.tier);
    loaded.profile.stage = clampToBounds(loaded.profile.stage, bounds);
    return loaded;
  }

  /** Persist. Keeps the previous good save as a backup in case a write is interrupted. */
  save(): boolean {
    if (!this.storage) return false;
    try {
      const json = JSON.stringify(this.state);
      const previous = this.storage.getItem(SAVE_KEY);
      if (previous !== null && parseSave(previous) !== null) this.storage.setItem(BACKUP_KEY, previous);
      this.storage.setItem(SAVE_KEY, json);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Record a finished question. Returns any change to the global (Quick Mission)
   * difficulty; pass `adapt: false` for campaign missions, which adapt locally.
   */
  recordQuestion(topic: TopicId, firstTry: boolean, attempts: number, adapt = true): DifficultyChange {
    const { stats, profile, settings } = this.state;
    stats.questionsAttempted++;
    stats.totalShotsAtAnswers += Math.max(1, attempts);
    if (firstTry) stats.firstTryCorrect++;
    const t = stats.byTopic[topic];
    t.attempted++;
    if (firstTry) t.firstTryCorrect++;
    stats.recent = [...stats.recent, { topic, firstTry, stage: profile.stage, at: this.now() }].slice(-LIMITS.recent);

    if (!adapt) {
      this.save();
      return null;
    }
    let change: DifficultyChange = null;
    const bounds = boundsFor(settings.adaptive, settings.tier);
    const result = applyResult(
      { stage: profile.stage, recent: profile.adaptiveRecent, sinceChange: profile.sinceChange },
      firstTry,
      bounds,
    );
    profile.stage = result.state.stage;
    profile.adaptiveRecent = result.state.recent;
    profile.sinceChange = result.state.sinceChange;
    change = result.change;
    if (change) this.pushStageHistory();
    this.save();
    return change;
  }

  private pushStageHistory(): void {
    const h = this.state.stats.stageHistory;
    this.state.stats.stageHistory = [...h, { stage: this.state.profile.stage, at: this.now() }].slice(-LIMITS.stageHistory);
  }

  isPlanetUnlocked(id: PlanetId): boolean {
    return isPlanetUnlocked(this.state.profile.campaign, id, this.state.settings.unlockAllPlanets);
  }

  completeMission(xpEarned: number, campaign?: CampaignClear): MissionResult {
    const p = this.state.profile;
    let newStar = false;
    let planetUnlocked: Planet | null = null;
    if (campaign) {
      // Only galaxy-map planets unlock a next planet (the TIE Academy isn't on the map).
      const index = planetIndex(campaign.planetId);
      const next = index >= 0 ? PLANETS[index + 1] : undefined;
      const nextWasOpen = next ? isPlanetUnlocked(p.campaign, next.id, false) : true;
      const cleared = p.campaign[campaign.planetId].cleared;
      newStar = !cleared[campaign.level - 1];
      cleared[campaign.level - 1] = true;
      if (next && !nextWasOpen && isPlanetUnlocked(p.campaign, next.id, false)) planetUnlocked = next;
    }
    const before = p.missionsCompleted;
    const rankBefore = rankForXp(p.totalXp);
    p.totalXp += Math.max(0, Math.floor(xpEarned));
    p.missionsCompleted++;
    const rankAfter = rankForXp(p.totalXp);
    const newUnlocks = newlyUnlocked(before, p.missionsCompleted);
    // Auto-equip the droid the moment it is earned — it's the first big surprise.
    if (newUnlocks.some((u) => u.kind === 'droid')) p.equipped.droid = true;
    this.save();
    return {
      xpEarned,
      newUnlocks,
      rankBefore: rankBefore.rank,
      rankAfter: rankAfter.rank,
      rankUp: rankAfter.index > rankBefore.index,
      newStar,
      planetUnlocked,
    };
  }

  equip(id: string): boolean {
    const u = unlockById(id);
    const p = this.state.profile;
    if (!u || !isUnlocked(id, p.missionsCompleted)) return false;
    if (u.kind === 'droid') p.equipped.droid = !p.equipped.droid;
    else p.equipped[u.kind] = id;
    this.save();
    return true;
  }

  updateSettings(patch: Partial<ParentSettings>): void {
    const old = this.state.settings;
    const next = sanitizeSettings({ ...old, ...patch });
    this.state.settings = next;
    const p = this.state.profile;
    if (patch.tier !== undefined && patch.tier !== old.tier) {
      // A parent choosing a level means "start here".
      p.stage = firstStageOfTier(next.tier);
      p.adaptiveRecent = [];
      p.sinceChange = 0;
      this.pushStageHistory();
    }
    p.stage = clampToBounds(p.stage, boundsFor(next.adaptive, next.tier));
    this.save();
  }

  /** Wipe progress and stats, keeping the parent's settings. */
  resetProgress(): void {
    const settings = this.state.settings;
    this.state = { ...defaultSave(), settings };
    this.state.profile = defaultProfile();
    this.state.profile.stage = clampToBounds(firstStageOfTier(settings.tier), boundsFor(settings.adaptive, settings.tier));
    this.state.stats = defaultStats();
    try {
      this.storage?.removeItem(BACKUP_KEY);
    } catch {
      /* ignore */
    }
    this.save();
  }
}
