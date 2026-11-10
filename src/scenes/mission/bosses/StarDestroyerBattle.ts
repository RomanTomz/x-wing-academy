import Phaser from 'phaser';
import { BOSS_TEX, DESTROYER_GRID } from '../../../art/bosses';
import { audio, speech } from '../../../core/services';
import type { Player } from '../../../entities/Player';
import type { Effects } from '../../../ui/effects';
import { BossBattle, type BossSlot } from './BossBattle';

/** Where the destroyer sits once it has arrived (its top-left corner, in screen px). */
const HOME = { x: -160, y: -200 };
// Kept well inside the hull, which narrows towards the nose.
const LANES = [345, 640, 935];
const TURRET_Y = 262;

/**
 * Rebel boss: fly over a Star Destroyer's deck. Turbolaser turrets rise out of
 * the hull carrying answers; right answers blow them up.
 */
export class StarDestroyerBattle extends BossBattle {
  private ship: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) {
    super(scene, fx, player, { label: 'Star Destroyer', boltLaser: 'laser-green', totalHits });
    this.ship = scene.add
      .image(HOME.x, HOME.y - DESTROYER_GRID.h * DESTROYER_GRID.scale, BOSS_TEX.destroyer)
      .setOrigin(0)
      .setScale(DESTROYER_GRID.scale)
      .setDepth(-50);
    this.body.push(this.ship);
  }

  intro(onDone: () => void): void {
    audio.play('whoosh');
    speech.speak('Warning! A Star Destroyer! Knock out its turrets!');
    this.fx.banner('WARNING: STAR DESTROYER!', '#ff6b6b', 360);
    this.scene.cameras.main.shake(2200, 0.003);
    this.scene.tweens.add({
      targets: this.ship,
      y: HOME.y,
      duration: 2600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.showHull();
        onDone();
      },
    });
  }

  slots(): BossSlot[] {
    return this.nudged(LANES).map((x, i) => ({ x, y: TURRET_Y + (i === 1 ? 14 : 0), look: 'turret', pattern: 'fixed' }));
  }

  protected victory(): { banner: string; speech: string } {
    return { banner: 'STAR DESTROYER DOWN!', speech: 'You did it! The Star Destroyer is going down!' };
  }
}
