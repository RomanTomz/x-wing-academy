export const XP = {
  correctAnswer: 100,
  /** Extra for hitting the right target with the first shot. */
  sharpshooter: 50,
  crystal: 10,
  asteroid: 5,
  missionComplete: 200,
} as const;

export interface Rank {
  name: string;
  xp: number;
}

export const RANKS: readonly Rank[] = [
  // Names avoid "Cadet / Pilot / Ace", which are the planet level names.
  { name: 'Recruit', xp: 0 },
  { name: 'Wingmate', xp: 1000 },
  { name: 'Flight Officer', xp: 2500 },
  { name: 'Sky Captain', xp: 4500 },
  { name: 'Flight Lieutenant', xp: 7000 },
  { name: 'Wing Commander', xp: 10000 },
  { name: 'Star Captain', xp: 14000 },
  { name: 'Galaxy Hero', xp: 20000 },
];

export interface RankInfo {
  index: number;
  rank: Rank;
  next: Rank | null;
  /** 0..1 progress towards the next rank (1 at max rank). */
  progress: number;
}

export function rankForXp(totalXp: number): RankInfo {
  const xp = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) index = i;
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { index, rank, next, progress };
}

export interface MissionXpInput {
  correctAnswers: number;
  /** Correct answers hit with the first shot (each earns the sharpshooter bonus). */
  firstTry?: number;
  crystals: number;
  asteroids: number;
  completed: boolean;
}

export function missionXp(input: MissionXpInput): number {
  return (
    Math.max(0, input.correctAnswers) * XP.correctAnswer +
    Math.max(0, input.firstTry ?? 0) * XP.sharpshooter +
    Math.max(0, input.crystals) * XP.crystal +
    Math.max(0, input.asteroids) * XP.asteroid +
    (input.completed ? XP.missionComplete : 0)
  );
}
