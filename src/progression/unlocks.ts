export type UnlockKind = 'ship' | 'paint' | 'laser' | 'trail' | 'droid';
export type ShipId = 'x-wing' | 'y-wing' | 'b-wing';

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
}

/**
 * Deterministic unlock track: one new reward for each of the first ten missions.
 * No randomness, no grinding.
 */
export const UNLOCKS: readonly Unlock[] = [
  // All three starfighters are free to choose from the start.
  { id: 'x-wing', kind: 'ship', name: 'X-Wing', missions: 0, color: 0xd8322e, blurb: 'Fast, with four cannons' },
  { id: 'y-wing', kind: 'ship', name: 'Y-Wing', missions: 0, color: 0xffc23f, blurb: 'Big blasts, twin cannons' },
  { id: 'b-wing', kind: 'ship', name: 'B-Wing', missions: 0, color: 0xff8a1f, blurb: 'Three cannons at once' },
  { id: 'paint-red', kind: 'paint', name: 'Rebel Red', missions: 0, color: 0xd8322e, accent: 0x8f1d1d },
  { id: 'laser-red', kind: 'laser', name: 'Red Lasers', missions: 0, color: 0xff4a4a },
  { id: 'trail-blue', kind: 'trail', name: 'Ion Blue Engines', missions: 0, color: 0x6fd3ff },

  { id: 'droid-bip', kind: 'droid', name: 'BIP-8 Droid Buddy', missions: 1, color: 0x3b82f6 },
  { id: 'paint-orange', kind: 'paint', name: 'Blaze Orange', missions: 2, color: 0xff8a1f, accent: 0xa84d00 },
  { id: 'laser-green', kind: 'laser', name: 'Emerald Lasers', missions: 3, color: 0x4dff7a },
  { id: 'paint-blue', kind: 'paint', name: 'Nova Blue', missions: 4, color: 0x2f7bff, accent: 0x173f8f },
  { id: 'trail-rainbow', kind: 'trail', name: 'Rainbow Engines', missions: 5, color: 0xff4fd8 },
  { id: 'paint-purple', kind: 'paint', name: 'Nebula Purple', missions: 6, color: 0xa24dff, accent: 0x5a1f9a },
  { id: 'laser-gold', kind: 'laser', name: 'Golden Lasers', missions: 7, color: 0xffd23f },
  { id: 'paint-green', kind: 'paint', name: 'Forest Moon Green', missions: 8, color: 0x3fbf5a, accent: 0x1f6b30 },
  { id: 'trail-comet', kind: 'trail', name: 'Comet Fire Engines', missions: 9, color: 0xff6a2a },
  { id: 'paint-gold', kind: 'paint', name: 'Gold Leader', missions: 10, color: 0xf2c230, accent: 0x9a7412 },
];

export function unlockById(id: string): Unlock | undefined {
  return UNLOCKS.find((u) => u.id === id);
}

export function isUnlocked(id: string, missionsCompleted: number): boolean {
  const u = unlockById(id);
  return u !== undefined && missionsCompleted >= u.missions;
}

export function unlocksOfKind(kind: UnlockKind): Unlock[] {
  return UNLOCKS.filter((u) => u.kind === kind);
}

/** Rewards earned by going from `before` to `after` completed missions. */
export function newlyUnlocked(before: number, after: number): Unlock[] {
  return UNLOCKS.filter((u) => u.missions > before && u.missions <= after);
}

/** The next reward still to earn, if any. */
export function nextUnlock(missionsCompleted: number): Unlock | null {
  return UNLOCKS.find((u) => u.missions > missionsCompleted) ?? null;
}
