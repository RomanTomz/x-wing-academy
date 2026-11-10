import Phaser from 'phaser';
import { BOSS_TEX } from '../../../art/bosses';
import { audio, speech } from '../../../core/services';
import type { Player } from '../../../entities/Player';
import type { Effects } from '../../../ui/effects';
import { BossBattle, type BossSlot } from './BossBattle';

const GENERATOR = { x: 640, y: 160, scale: 3.4 };
const LANES = [300, 640, 980];
const TURRET_Y = 300;

/**
 * Empire boss on Hoth: skim the snow towards the rebels' shield generator.
 * Its defence turrets carry the answers and fire red bolts back.
 */
export class ShieldGeneratorBattle extends BossBattle {
  private generator: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) {
    super(scene, fx, player, { label: 'Shield Generator', boltLaser: 'laser-red', totalHits });
    this.generator = scene.add.image(GENERATOR.x, -200, BOSS_TEX.generator).setScale(GENERATOR.scale).setDepth(-50);
    this.body.push(this.generator);
  }

  intro(onDone: () => void): void {
    audio.play('whoosh');
    speech.speak('There is the rebel shield generator! Knock out its defence turrets!');
    this.fx.banner('TARGET: SHIELD GENERATOR!', '#ff6b6b', 360);
    this.scene.cameras.main.shake(1800, 0.003);
    this.scene.tweens.add({
      targets: this.generator,
      y: GENERATOR.y,
      duration: 2400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.showHull();
        onDone();
      },
    });
  }

  slots(): BossSlot[] {
    return this.nudged(LANES).map((x, i) => ({ x, y: TURRET_Y + (i === 1 ? 10 : 0), look: 'rebel-turret', pattern: 'fixed' }));
  }

  protected victory(): { banner: string; speech: string } {
    return { banner: 'SHIELDS ARE DOWN!', speech: 'Great flying! The shield generator is destroyed!' };
  }
}
