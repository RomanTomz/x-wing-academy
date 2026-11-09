import type { Tier, TopicId } from '../education/types';

export type PlanetId = 'training-moon' | 'frost-planet' | 'dune-world' | 'forest-moon' | 'tie-academy';
export type ThemeId = 'moon' | 'frost' | 'dune' | 'forest' | 'hull';
export type Faction = 'rebel' | 'empire';
export type Level = Tier;

export const LEVELS: readonly Level[] = [1, 2, 3];
export const LEVEL_NAMES: Record<Level, string> = { 1: 'Cadet', 2: 'Pilot', 3: 'Ace' };

export interface Planet {
  id: PlanetId;
  name: string;
  theme: ThemeId;
  /** Rebel planets are on the galaxy map; the empire entry is the TIE Academy. */
  faction: Faction;
  /** Short description of the maths focus, for the map. */
  focus: string;
  topics: readonly TopicId[];
  /** What each level practises, in parent-friendly words. */
  levelInfo: Record<Level, string>;
  briefing: (pilot: string, level: Level) => string;
}

export const PLANETS: readonly Planet[] = [
  {
    id: 'training-moon',
    name: 'Training Moon',
    theme: 'moon',
    faction: 'rebel',
    focus: 'Number bonds',
    topics: ['number-bonds'],
    levelInfo: { 1: 'Bonds to 10', 2: 'Bonds to 20', 3: 'Bonds to 100' },
    briefing: (n, l) =>
      `Pilot ${n}! Enemy fighters are hiding in the moon's craters. Each number needs a partner to make ${l === 1 ? 'up to 10' : l === 2 ? '20' : '100'}. Find the missing partner!`,
  },
  {
    id: 'frost-planet',
    name: 'Frost Planet',
    theme: 'frost',
    faction: 'rebel',
    focus: 'Adding & taking away',
    topics: ['addition', 'subtraction'],
    levelInfo: { 1: 'Within 10', 2: 'Within 20', 3: 'Within 100' },
    briefing: (n) => `Brrr, ${n}! Enemy fighters are flying over the ice fields. Add and take away to find the right targets. Watch out for icebergs!`,
  },
  {
    id: 'dune-world',
    name: 'Dune World',
    theme: 'dune',
    faction: 'rebel',
    focus: 'Missing numbers',
    topics: ['missing-number'],
    levelInfo: { 1: 'Within 10', 2: 'Within 20', 3: 'Within 100' },
    briefing: (n) => `A sandstorm is coming, ${n}! Enemy fighters have hidden numbers in the desert. Work out the missing number to find them!`,
  },
  {
    id: 'forest-moon',
    name: 'Forest Moon',
    theme: 'forest',
    faction: 'rebel',
    focus: 'Counting patterns',
    topics: ['counting'],
    levelInfo: { 1: 'Count in 1s, 2s & 10s', 2: 'Count in 2s, 5s & 10s', 3: 'Count in 3s too, and backwards' },
    briefing: (n) => `Pilot ${n}, enemy fighters are flying in patterns over the forest. Spot the pattern and shoot the number that comes next!`,
  },
];

/** Fly a TIE fighter: X-wings carry the answers, and the maths is different. */
export const TIE_ACADEMY: Planet = {
  id: 'tie-academy',
  name: 'TIE Academy',
  theme: 'hull',
  faction: 'empire',
  focus: 'Bigger & smaller, tens & ones, halves & quarters, odd & even',
  topics: ['compare', 'place-value', 'fractions', 'odd-even'],
  levelInfo: { 1: 'Numbers to 20', 2: 'Numbers to 50', 3: 'Numbers to 100' },
  briefing: (n) =>
    `Welcome to the TIE Academy, ${n}! Today you fly a TIE fighter. X-wings are zooming past the space station. Use < and >, tens and ones, halves and odd numbers to find the right target!`,
};

/** Every mission location: the galaxy map planets plus the TIE Academy. */
export const ALL_PLANETS: readonly Planet[] = [...PLANETS, TIE_ACADEMY];

export function planetById(id: string): Planet | undefined {
  return ALL_PLANETS.find((p) => p.id === id);
}

/** Position on the galaxy map, or -1 for places that aren't on it (the TIE Academy). */
export function planetIndex(id: PlanetId): number {
  return PLANETS.findIndex((p) => p.id === id);
}

/** Levels cleared per planet: index 0 = Cadet, 1 = Pilot, 2 = Ace. */
export interface PlanetProgress {
  cleared: [boolean, boolean, boolean];
}

export type CampaignProgress = Record<PlanetId, PlanetProgress>;

export function defaultCampaign(): CampaignProgress {
  const c = {} as CampaignProgress;
  for (const p of ALL_PLANETS) c[p.id] = { cleared: [false, false, false] };
  return c;
}

export function starsFor(progress: CampaignProgress, id: PlanetId): number {
  return progress[id]?.cleared.filter(Boolean).length ?? 0;
}

/** The first planet is always open; each next one opens when any level of the previous is cleared. */
export function isPlanetUnlocked(progress: CampaignProgress, id: PlanetId, unlockAll: boolean): boolean {
  if (unlockAll) return true;
  if (planetById(id)?.faction === 'empire') return true;
  const i = planetIndex(id);
  if (i <= 0) return i === 0;
  return starsFor(progress, PLANETS[i - 1].id) > 0;
}

export type MissionConfig = { mode: 'quick' } | { mode: 'campaign'; planetId: PlanetId; level: Level };

export const QUICK_MISSION: MissionConfig = { mode: 'quick' };

export function isMissionConfig(v: unknown): v is MissionConfig {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.mode === 'quick') return true;
  return o.mode === 'campaign' && typeof o.planetId === 'string' && planetById(o.planetId) !== undefined && (o.level === 1 || o.level === 2 || o.level === 3);
}
