import type { Tier, TopicId } from '../education/types';

export type PlanetId = 'training-moon' | 'frost-planet' | 'dune-world' | 'forest-moon' | 'tie-academy' | 'star-destroyer';
export type ThemeId = 'moon' | 'frost' | 'dune' | 'forest' | 'hull';
export type Faction = 'rebel' | 'empire';
export type Level = Tier;

export const LEVELS: readonly Level[] = [1, 2, 3];
export const LEVEL_NAMES: Record<Level, string> = { 1: 'Cadet', 2: 'Pilot', 3: 'Ace' };

export interface Planet {
  id: PlanetId;
  name: string;
  /** Scenery; bosses fight in open space. */
  theme: ThemeId | 'space';
  /** Rebel planets are on the galaxy map; the empire entry is the TIE Academy. */
  faction: Faction;
  /** Boss battles sit between planets on the map. */
  kind: 'planet' | 'boss';
  /** Bosses open once this place has a star. */
  unlockAfter?: PlanetId;
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
    kind: 'planet',
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
    kind: 'planet',
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
    kind: 'planet',
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
    kind: 'planet',
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
  kind: 'planet',
  focus: 'Bigger & smaller, tens & ones, halves & quarters, odd & even',
  topics: ['compare', 'place-value', 'fractions', 'odd-even'],
  levelInfo: { 1: 'Numbers to 20', 2: 'Numbers to 50', 3: 'Numbers to 100' },
  briefing: (n) =>
    `Welcome to the TIE Academy, ${n}! Today you fly a TIE fighter. X-wings are zooming past the space station. Use < and >, tens and ones, halves and odd numbers to find the right target!`,
};

/**
 * Boss battles: one giant enemy, a brand-new Year 2 topic each, and a special reward.
 * They're bonus fights between planets — they never block the next planet.
 */
export const BOSSES: readonly Planet[] = [
  {
    id: 'star-destroyer',
    name: 'Star Destroyer',
    theme: 'space',
    faction: 'rebel',
    kind: 'boss',
    unlockAfter: 'training-moon',
    focus: 'Times & sharing (2, 5, 10)',
    topics: ['times-divide'],
    levelInfo: { 1: '× 2 and × 10', 2: '× and ÷ by 2, 5, 10', 3: 'Missing numbers & groups' },
    briefing: (n) =>
      `Warning, Pilot ${n}! A Star Destroyer is blocking the hyperspace lane. Knock out its turbolaser turrets with times tables and sharing. Dodge the green bolts!`,
  },
];

/** Hits needed to bring down a boss. */
export const BOSS_HITS = 7;

/** Every mission location: galaxy map planets, bosses and the TIE Academy. */
export const ALL_PLANETS: readonly Planet[] = [...PLANETS, ...BOSSES, TIE_ACADEMY];

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
  const place = planetById(id);
  if (place?.faction === 'empire' && place.kind === 'planet') return true;
  if (place?.kind === 'boss') return place.unlockAfter !== undefined && starsFor(progress, place.unlockAfter) > 0;
  const i = planetIndex(id);
  if (i <= 0) return i === 0;
  return starsFor(progress, PLANETS[i - 1].id) > 0;
}

/** Bosses beaten at any level (used for boss rewards). */
export function beatenBosses(progress: CampaignProgress): Set<string> {
  return new Set(BOSSES.filter((b) => starsFor(progress, b.id) > 0).map((b) => b.id));
}

export type MissionConfig = { mode: 'quick' } | { mode: 'campaign'; planetId: PlanetId; level: Level };

export const QUICK_MISSION: MissionConfig = { mode: 'quick' };

export function isMissionConfig(v: unknown): v is MissionConfig {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.mode === 'quick') return true;
  return o.mode === 'campaign' && typeof o.planetId === 'string' && planetById(o.planetId) !== undefined && (o.level === 1 || o.level === 2 || o.level === 3);
}
