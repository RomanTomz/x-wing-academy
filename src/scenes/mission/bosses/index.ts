import type Phaser from 'phaser';
import type { Player } from '../../../entities/Player';
import type { PlanetId } from '../../../progression/campaign';
import type { Effects } from '../../../ui/effects';
import type { BossBattle } from './BossBattle';
import { DeathStarBattle } from './DeathStarBattle';
import { FlagshipBattle } from './FlagshipBattle';
import { ShieldGeneratorBattle } from './ShieldGeneratorBattle';
import { StarDestroyerBattle } from './StarDestroyerBattle';

export type { BossBattle, BossSlot } from './BossBattle';

type BossCtor = new (scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) => BossBattle;

const BATTLES: Partial<Record<PlanetId, BossCtor>> = {
  'star-destroyer': StarDestroyerBattle,
  'death-star': DeathStarBattle,
  'hoth-generator': ShieldGeneratorBattle,
  'rebel-flagship': FlagshipBattle,
};

export function createBossBattle(id: PlanetId, scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number): BossBattle | null {
  const Battle = BATTLES[id];
  return Battle ? new Battle(scene, fx, player, totalHits) : null;
}
