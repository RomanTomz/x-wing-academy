import type { Faction } from './campaign';

export type UnlockKind = 'ship' | 'paint' | 'laser' | 'trail' | 'droid';
export type RebelShipId = 'x-wing' | 'y-wing' | 'b-wing';
export type EmpireShipId = 'tie-fighter' | 'tie-interceptor' | 'tie-bomber' | 'tie-advanced';
export type ShipId = RebelShipId | EmpireShipId;
export const REBEL_SHIPS: readonly RebelShipId[] = ['x-wing', 'y-wing', 'b-wing'];
export const EMPIRE_SHIPS: readonly EmpireShipId[] = ['tie-fighter', 'tie-interceptor', 'tie-bomber', 'tie-advanced'];

export interface Unlock {
  id: string;
  kind: UnlockKind;
  name: string;
  /** Missions that must be completed to earn it. 0 = available from the start. */
  missions: number;
  /** Main colour, used for previews and for tinting. */
  color: number;
  /** Secondary colour for paint jobs. */
  accent?: number;
  /** Short description (ships). */
  blurb?: string;
  /** Earned by beating this boss (at any level) instead of by mission count. */
  boss?: string;
  /** Ships belong to one side; everything else works on both. */
  faction?: Faction;
}

/**
 * Deterministic unlock track: one new reward for each of the first ten missions.
 * No randomness, no grinding.
 */
export const UNLOCKS: readonly Unlock[] = [
  // Every starfighter is free to choose from the start.
  { id: 'x-wing', kind: 'ship', faction: 'rebel', name: 'X-Wing', missions: 0, color: 0xd8322e, blurb: 'Fast, with four cannons' },
  { id: 'y-wing', kind: 'ship', faction: 'rebel', name: 'Y-Wing', missions: 0, color: 0xffc23f, blurb: 'Big blasts, twin cannons' },
  { id: 'b-wing', kind: 'ship', faction: 'rebel', name: 'B-Wing', missions: 0, color: 0xff8a1f, blurb: 'Three cannons at once' },
  { id: 'tie-fighter', kind: 'ship', faction: 'empire', name: 'TIE Fighter', missions: 0, color: 0xa9b3c9, blurb: 'Quick, with twin cannons' },
  { id: 'tie-interceptor', kind: 'ship', faction: 'empire', name: 'TIE Interceptor', missions: 0, color: 0xa9b3c9, blurb: 'Super fast, four wing cannons' },
  { id: 'tie-bomber', kind: 'ship', faction: 'empire', name: 'TIE Bomber', missions: 0, color: 0xa9b3c9, blurb: 'Slow, with huge blasts' },
  { id: 'tie-advanced', kind: 'ship', faction: 'empire', name: 'TIE Advanced', missions: 0, color: 0xa9b3c9, blurb: 'Fast, three cannons at once' },
  { id: 'paint-red', kind: 'paint', name: 'Rebel Red', missions: 0, color: 0xd8322e, accent: 0x8f1d1d },
  { id: 'paint-imperial', kind: 'paint', name: 'Imperial Grey', missions: 0, color: 0xa9b3c9, accent: 0x5d6680 },
  { id: 'laser-red', kind: 'laser', name: 'Red Lasers', missions: 0, color: 0xff4a4a },
  { id: 'laser-green', kind: 'laser', name: 'Emerald Lasers', missions: 0, color: 0x4dff7a },
  { id: 'trail-blue', kind: 'trail', name: 'Ion Blue Engines', missions: 0, color: 0x6fd3ff },

  { id: 'droid-bip', kind: 'droid', name: 'BIP-8 Droid Buddy', missions: 1, color: 0x3b82f6 },
  { id: 'paint-orange', kind: 'paint', name: 'Blaze Orange', missions: 2, color: 0xff8a1f, accent: 0xa84d00 },
  { id: 'trail-white', kind: 'trail', name: 'Twin Ion White', missions: 3, color: 0xe8f4ff },
  { id: 'paint-blue', kind: 'paint', name: 'Nova Blue', missions: 4, color: 0x2f7bff, accent: 0x173f8f },
  { id: 'trail-rainbow', kind: 'trail', name: 'Rainbow Engines', missions: 5, color: 0xff4fd8 },
  { id: 'paint-purple', kind: 'paint', name: 'Nebula Purple', missions: 6, color: 0xa24dff, accent: 0x5a1f9a },
  { id: 'laser-gold', kind: 'laser', name: 'Golden Lasers', missions: 7, color: 0xffd23f },
  { id: 'paint-green', kind: 'paint', name: 'Forest Moon Green', missions: 8, color: 0x3fbf5a, accent: 0x1f6b30 },
  { id: 'trail-comet', kind: 'trail', name: 'Comet Fire Engines', missions: 9, color: 0xff6a2a },
  { id: 'paint-gold', kind: 'paint', name: 'Gold Leader', missions: 10, color: 0xf2c230, accent: 0x9a7412 },

  // Boss trophies.
  { id: 'paint-destroyer', kind: 'paint', name: 'Destroyer Hunter', missions: 0, boss: 'star-destroyer', color: 0x3fd46a, accent: 0x1c7a36 },
  { id: 'trail-hyperspace', kind: 'trail', name: 'Hyperspace Streak', missions: 0, boss: 'death-star', color: 0xbfe8ff },
  { id: 'laser-ion', kind: 'laser', name: 'Ion Blue Lasers', missions: 0, boss: 'hoth-generator', color: 0x5ab4ff },
  { id: 'paint-dark', kind: 'paint', name: 'Dark Lord Black', missions: 0, boss: 'rebel-flagship', color: 0x2a2d36, accent: 0xb3202a },
];

export function isShipFor(id: string, faction: Faction): boolean {
  const u = unlockById(id);
  return u?.kind === 'ship' && u.faction === faction;
}

export function unlockById(id: string): Unlock | undefined {
  return UNLOCKS.find((u) => u.id === id);
}

/** Boss ids that have been beaten (any level). */
export type BeatenBosses = ReadonlySet<string>;

export function isUnlocked(id: string, missionsCompleted: number, beaten: BeatenBosses = new Set()): boolean {
  const u = unlockById(id);
  if (!u) return false;
  if (u.boss) return beaten.has(u.boss);
  return missionsCompleted >= u.missions;
}

/** Rewards for beating a boss for the first time. */
export function bossRewards(bossId: string): Unlock[] {
  return UNLOCKS.filter((u) => u.boss === bossId);
}

/** Items of one kind; ships only for the given side. */
export function unlocksOfKind(kind: UnlockKind, faction?: Faction): Unlock[] {
  return UNLOCKS.filter((u) => u.kind === kind && (kind !== 'ship' || faction === undefined || u.faction === faction));
}

/** Rewards earned by going from `before` to `after` completed missions. */
export function newlyUnlocked(before: number, after: number): Unlock[] {
  return UNLOCKS.filter((u) => !u.boss && u.missions > before && u.missions <= after);
}

/** The next reward still to earn, if any. */
export function nextUnlock(missionsCompleted: number): Unlock | null {
  return UNLOCKS.find((u) => !u.boss && u.missions > missionsCompleted) ?? null;
}
