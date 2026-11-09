import { ALL_TOPICS, type Tier, type TopicId } from '../education/types';
import { MISSION_LENGTHS, type MissionLength } from '../progression/mission';

export interface ParentSettings {
  pilotName: string;
  topics: Record<TopicId, boolean>;
  adaptive: boolean;
  /** Starting tier when adaptive, or the locked tier when not. */
  tier: Tier;
  missionLength: MissionLength;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  speech: boolean;
  /** Open every planet on the galaxy map instead of unlocking them one by one. */
  unlockAllPlanets: boolean;
}

export function defaultSettings(): ParentSettings {
  const topics = {} as Record<TopicId, boolean>;
  for (const t of ALL_TOPICS) topics[t] = true;
  return {
    pilotName: 'Nova',
    topics,
    adaptive: true,
    tier: 1,
    missionLength: 10,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    muted: false,
    speech: true,
    unlockAllPlanets: false,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function volume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

export function sanitizeName(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const cleaned = v.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 16);
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Turn anything (e.g. corrupted JSON) into valid settings, keeping whatever is usable. */
export function sanitizeSettings(raw: unknown): ParentSettings {
  const d = defaultSettings();
  if (!isRecord(raw)) return d;
  const topics = { ...d.topics };
  if (isRecord(raw.topics)) {
    for (const t of ALL_TOPICS) if (typeof raw.topics[t] === 'boolean') topics[t] = raw.topics[t] as boolean;
  }
  const tier = raw.tier === 1 || raw.tier === 2 || raw.tier === 3 ? raw.tier : d.tier;
  const missionLength = MISSION_LENGTHS.includes(raw.missionLength as MissionLength)
    ? (raw.missionLength as MissionLength)
    : d.missionLength;
  return {
    pilotName: sanitizeName(raw.pilotName, d.pilotName),
    topics,
    adaptive: typeof raw.adaptive === 'boolean' ? raw.adaptive : d.adaptive,
    tier,
    missionLength,
    musicVolume: volume(raw.musicVolume, d.musicVolume),
    sfxVolume: volume(raw.sfxVolume, d.sfxVolume),
    muted: typeof raw.muted === 'boolean' ? raw.muted : d.muted,
    speech: typeof raw.speech === 'boolean' ? raw.speech : d.speech,
    unlockAllPlanets: typeof raw.unlockAllPlanets === 'boolean' ? raw.unlockAllPlanets : d.unlockAllPlanets,
  };
}
