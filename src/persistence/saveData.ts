import { clampStage } from '../education/stages';
import { ALL_TOPICS, type TopicId } from '../education/types';
import { defaultSettings, sanitizeSettings, type ParentSettings } from '../settings/settings';
import { isUnlocked, unlockById, type UnlockKind } from '../progression/unlocks';
import { ALL_PLANETS, defaultCampaign, type CampaignProgress } from '../progression/campaign';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'xwing-academy.save';
export const BACKUP_KEY = 'xwing-academy.save.backup';

export interface TopicStats {
  attempted: number;
  firstTryCorrect: number;
}

export interface RecentResult {
  topic: TopicId;
  firstTry: boolean;
  stage: number;
  at: number;
}

export interface Equipped {
  ship: string;
  paint: string;
  laser: string;
  trail: string;
  droid: boolean;
}

export interface Profile {
  totalXp: number;
  missionsCompleted: number;
  stage: number;
  adaptiveRecent: boolean[];
  sinceChange: number;
  equipped: Equipped;
  campaign: CampaignProgress;
}

export interface Stats {
  questionsAttempted: number;
  firstTryCorrect: number;
  totalShotsAtAnswers: number;
  byTopic: Record<TopicId, TopicStats>;
  recent: RecentResult[];
  stageHistory: { stage: number; at: number }[];
}

export interface SaveData {
  version: number;
  profile: Profile;
  stats: Stats;
  settings: ParentSettings;
}

export const LIMITS = { recent: 30, stageHistory: 60 } as const;

export function defaultProfile(): Profile {
  return {
    totalXp: 0,
    missionsCompleted: 0,
    stage: 0,
    adaptiveRecent: [],
    sinceChange: 0,
    equipped: { ship: 'x-wing', paint: 'paint-red', laser: 'laser-red', trail: 'trail-blue', droid: false },
    campaign: defaultCampaign(),
  };
}

export function defaultStats(): Stats {
  const byTopic = {} as Record<TopicId, TopicStats>;
  for (const t of ALL_TOPICS) byTopic[t] = { attempted: 0, firstTryCorrect: 0 };
  return { questionsAttempted: 0, firstTryCorrect: 0, totalShotsAtAnswers: 0, byTopic, recent: [], stageHistory: [] };
}

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, profile: defaultProfile(), stats: defaultStats(), settings: defaultSettings() };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const isTopic = (v: unknown): v is TopicId => typeof v === 'string' && (ALL_TOPICS as readonly string[]).includes(v);

function sanitizeEquipped(raw: unknown, missions: number): Equipped {
  const d = defaultProfile().equipped;
  if (!isRecord(raw)) return d;
  const pick = (id: unknown, kind: UnlockKind, fallback: string): string =>
    typeof id === 'string' && unlockById(id)?.kind === kind && isUnlocked(id, missions) ? id : fallback;
  return {
    ship: pick(raw.ship, 'ship', d.ship),
    paint: pick(raw.paint, 'paint', d.paint),
    laser: pick(raw.laser, 'laser', d.laser),
    trail: pick(raw.trail, 'trail', d.trail),
    droid: raw.droid === true && isUnlocked('droid-bip', missions),
  };
}

function sanitizeCampaign(raw: unknown): CampaignProgress {
  const c = defaultCampaign();
  if (!isRecord(raw)) return c;
  for (const p of ALL_PLANETS) {
    const entry = raw[p.id];
    if (!isRecord(entry) || !Array.isArray(entry.cleared)) continue;
    const cl = entry.cleared;
    c[p.id] = { cleared: [cl[0] === true, cl[1] === true, cl[2] === true] };
  }
  return c;
}

function sanitizeProfile(raw: unknown): Profile {
  const d = defaultProfile();
  if (!isRecord(raw)) return d;
  const missionsCompleted = count(raw.missionsCompleted);
  return {
    totalXp: count(raw.totalXp),
    missionsCompleted,
    stage: clampStage(typeof raw.stage === 'number' ? raw.stage : 0),
    adaptiveRecent: Array.isArray(raw.adaptiveRecent)
      ? raw.adaptiveRecent.filter((r): r is boolean => typeof r === 'boolean').slice(-10)
      : [],
    sinceChange: count(raw.sinceChange),
    equipped: sanitizeEquipped(raw.equipped, missionsCompleted),
    campaign: sanitizeCampaign(raw.campaign),
  };
}

function sanitizeStats(raw: unknown): Stats {
  const d = defaultStats();
  if (!isRecord(raw)) return d;
  const byTopic = d.byTopic;
  if (isRecord(raw.byTopic)) {
    for (const t of ALL_TOPICS) {
      const s = raw.byTopic[t];
      if (isRecord(s)) {
        const attempted = count(s.attempted);
        byTopic[t] = { attempted, firstTryCorrect: Math.min(attempted, count(s.firstTryCorrect)) };
      }
    }
  }
  const recent: RecentResult[] = Array.isArray(raw.recent)
    ? raw.recent
        .filter(isRecord)
        .filter((r) => isTopic(r.topic) && typeof r.firstTry === 'boolean')
        .map((r) => ({ topic: r.topic as TopicId, firstTry: r.firstTry as boolean, stage: clampStage(Number(r.stage)), at: count(r.at) }))
        .slice(-LIMITS.recent)
    : [];
  const stageHistory = Array.isArray(raw.stageHistory)
    ? raw.stageHistory
        .filter(isRecord)
        .map((h) => ({ stage: clampStage(Number(h.stage)), at: count(h.at) }))
        .slice(-LIMITS.stageHistory)
    : [];
  const questionsAttempted = count(raw.questionsAttempted);
  return {
    questionsAttempted,
    firstTryCorrect: Math.min(questionsAttempted, count(raw.firstTryCorrect)),
    totalShotsAtAnswers: count(raw.totalShotsAtAnswers),
    byTopic,
    recent,
    stageHistory,
  };
}

/** Validate an arbitrary parsed object into a complete, safe SaveData. */
export function sanitizeSave(raw: unknown): SaveData {
  if (!isRecord(raw)) return defaultSave();
  return {
    version: SAVE_VERSION,
    profile: sanitizeProfile(raw.profile),
    stats: sanitizeStats(raw.stats),
    settings: sanitizeSettings(raw.settings),
  };
}

/** Parse saved JSON. Returns null if the text is not usable at all. */
export function parseSave(text: string | null): SaveData | null {
  if (text === null || text === '') return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) return null;
    return sanitizeSave(parsed);
  } catch {
    return null;
  }
}
