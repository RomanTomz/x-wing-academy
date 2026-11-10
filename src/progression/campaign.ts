import type { Tier, TopicId } from '../education/types';

export type PlanetId =
  | 'training-moon'
  | 'frost-planet'
  | 'dune-world'
  | 'forest-moon'
  | 'tie-academy'
  | 'jedha'
  | 'yavin-4'
  | 'scarif'
  | 'star-destroyer'
  | 'death-star'
  | 'hoth-generator'
  | 'rebel-flagship';
export type ThemeId = 'moon' | 'frost' | 'dune' | 'forest' | 'hull' | 'tropic' | 'deathstar';
export type Faction = 'rebel' | 'empire';
export type Level = Tier;

export const FACTIONS: readonly Faction[] = ['rebel', 'empire'];
export const LEVELS: readonly Level[] = [1, 2, 3];
export const LEVEL_NAMES: Record<Level, string> = { 1: 'Cadet', 2: 'Pilot', 3: 'Ace' };

export interface Planet {
  id: PlanetId;
  name: string;
  /** Scenery; some bosses fight in open space. */
  theme: ThemeId | 'space';
  /** Which career this place belongs to. */
  faction: Faction;
  /** Boss battles sit between planets on the map; the final boss ends the career. */
  kind: 'planet' | 'boss';
  /** Bosses open once this place has a star. */
  unlockAfter?: PlanetId;
  /** The career's last battle: harder questions and one final shot to finish it. */
  final?: boolean;
  /** Topic for the last, decisive question of a final boss. */
  finalTopic?: TopicId;
  /** Short description of the maths focus, for the map. */
  focus: string;
  topics: readonly TopicId[];
  /** What each level practises, in parent-friendly words. */
  levelInfo: Record<Level, string>;
  briefing: (pilot: string, level: Level) => string;
}

export const REBEL_PLANETS: readonly Planet[] = [
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

/** The Empire career: fly a TIE fighter against Rebel bases. X-wings carry the answers. */
export const EMPIRE_PLANETS: readonly Planet[] = [
  {
    id: 'tie-academy',
    name: 'TIE Academy',
    theme: 'hull',
    faction: 'empire',
    kind: 'planet',
    focus: 'Bigger or smaller (< = >)',
    topics: ['compare'],
    levelInfo: { 1: 'Numbers to 20', 2: 'Numbers to 50', 3: 'Numbers to 100' },
    briefing: (n) =>
      `Welcome to the TIE Academy, cadet ${n}! Rebel X-wings are buzzing round the space station. Is it bigger, smaller or the same? Pick the right sign: < = or >!`,
  },
  {
    id: 'jedha',
    name: 'Jedha',
    theme: 'dune',
    faction: 'empire',
    kind: 'planet',
    focus: 'Tens & ones',
    topics: ['place-value'],
    levelInfo: { 1: 'Teen numbers', 2: 'Tens and ones to 50', 3: 'Tens and ones to 100' },
    briefing: (n) => `Pilot ${n}, rebels are hiding in the desert city of Jedha. Count the tens and ones to find which X-wing to chase!`,
  },
  {
    id: 'yavin-4',
    name: 'Yavin 4',
    theme: 'forest',
    faction: 'empire',
    kind: 'planet',
    focus: 'Odd & even',
    topics: ['odd-even'],
    levelInfo: { 1: 'Numbers to 20', 2: 'Numbers to 50', 3: 'Numbers to 100' },
    briefing: (n) => `The rebel base is on the jungle moon Yavin 4, ${n}! X-wings are taking off over the temples. Spot the odd and even numbers!`,
  },
  {
    id: 'scarif',
    name: 'Scarif',
    theme: 'tropic',
    faction: 'empire',
    kind: 'planet',
    focus: 'Halves & quarters',
    topics: ['fractions'],
    levelInfo: { 1: 'Doubles and halves', 2: 'Halves and quarters', 3: 'Halves, quarters, ¾ and ⅓' },
    briefing: (n) => `Rebels are attacking the beaches of Scarif, ${n}! Find halves and quarters to pick the right X-wing. Fly fast over the islands!`,
  },
];

/**
 * Boss battles: one giant enemy and a special reward. Mid-career bosses are
 * bonus fights between planets (they never block the next planet); each career
 * ends with a final boss that opens after its last planet.
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
  {
    id: 'death-star',
    name: 'Death Star',
    theme: 'deathstar',
    faction: 'rebel',
    kind: 'boss',
    final: true,
    unlockAfter: 'forest-moon',
    finalTopic: 'two-step',
    focus: 'Everything you have learned!',
    topics: ['number-bonds', 'addition', 'subtraction', 'missing-number', 'counting', 'times-divide'],
    levelInfo: { 1: 'Hard Cadet questions', 2: 'Hard Pilot questions', 3: 'Hard Ace questions' },
    briefing: (n) =>
      `This is it, Pilot ${n}! The Death Star is here. Blast its cannons and TIE fighters with your best maths. Then one last sum to fire the proton torpedo. May the Force be with you!`,
  },
  {
    id: 'hoth-generator',
    name: 'Hoth Shield Generator',
    theme: 'frost',
    faction: 'empire',
    kind: 'boss',
    unlockAfter: 'tie-academy',
    focus: '< >, tens & ones, halves, odd & even',
    topics: ['compare', 'place-value', 'fractions', 'odd-even'],
    levelInfo: { 1: 'Numbers to 20', 2: 'Numbers to 50', 3: 'Numbers to 100' },
    briefing: (n) =>
      `Pilot ${n}, the rebels have a shield generator on the ice planet Hoth. Knock out the ion cannons guarding it, and watch out for the red bolts!`,
  },
  {
    id: 'rebel-flagship',
    name: 'Rebel Flagship',
    theme: 'space',
    faction: 'empire',
    kind: 'boss',
    final: true,
    unlockAfter: 'scarif',
    finalTopic: 'place-value',
    focus: 'Everything you have learned!',
    topics: ['compare', 'place-value', 'fractions', 'odd-even', 'times-divide'],
    levelInfo: { 1: 'Hard Cadet questions', 2: 'Hard Pilot questions', 3: 'Hard Ace questions' },
    briefing: (n) =>
      `The rebel flagship is escaping, ${n}! Knock out its cannons and the X-wings guarding it. Then one last question to hit its shield generator!`,
  },
];

/** Hits needed to bring down a boss: final bosses take one more, the final shot. */
export const BOSS_HITS = 7;
export function bossHits(p: Planet): number {
  return p.final ? BOSS_HITS + 1 : BOSS_HITS;
}

/** Every mission location. */
export const ALL_PLANETS: readonly Planet[] = [...REBEL_PLANETS, ...EMPIRE_PLANETS, ...BOSSES];

/** A career's planets in unlock order. */
export function chainFor(faction: Faction): readonly Planet[] {
  return faction === 'rebel' ? REBEL_PLANETS : EMPIRE_PLANETS;
}

export function bossesFor(faction: Faction): Planet[] {
  return BOSSES.filter((b) => b.faction === faction);
}

export function planetById(id: string): Planet | undefined {
  return ALL_PLANETS.find((p) => p.id === id);
}

/** Position in its career's chain of planets, or -1 for bosses. */
export function planetIndex(id: PlanetId): number {
  const place = planetById(id);
  if (!place || place.kind !== 'planet') return -1;
  return chainFor(place.faction).findIndex((p) => p.id === id);
}

/** The planet that opens after this one in its career, if any. */
export function nextPlanet(id: PlanetId): Planet | undefined {
  const place = planetById(id);
  const i = planetIndex(id);
  return place && i >= 0 ? chainFor(place.faction)[i + 1] : undefined;
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

/**
 * Each career's first planet is always open; each next one opens when any level
 * of the previous is cleared. Bosses open when their `unlockAfter` has a star.
 */
export function isPlanetUnlocked(progress: CampaignProgress, id: PlanetId, unlockAll: boolean): boolean {
  if (unlockAll) return true;
  const place = planetById(id);
  if (!place) return false;
  if (place.kind === 'boss') return place.unlockAfter !== undefined && starsFor(progress, place.unlockAfter) > 0;
  const i = planetIndex(id);
  if (i <= 0) return i === 0;
  return starsFor(progress, chainFor(place.faction)[i - 1].id) > 0;
}

/** Bosses beaten at any level (used for boss rewards). */
export function beatenBosses(progress: CampaignProgress): Set<string> {
  return new Set(BOSSES.filter((b) => starsFor(progress, b.id) > 0).map((b) => b.id));
}

export type MissionConfig = { mode: 'quick' } | { mode: 'campaign'; planetId: PlanetId; level: Level };

export const QUICK_MISSION: MissionConfig = { mode: 'quick' };

export function isFaction(v: unknown): v is Faction {
  return v === 'rebel' || v === 'empire';
}

export function isMissionConfig(v: unknown): v is MissionConfig {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.mode === 'quick') return true;
  return o.mode === 'campaign' && typeof o.planetId === 'string' && planetById(o.planetId) !== undefined && (o.level === 1 || o.level === 2 || o.level === 3);
}
