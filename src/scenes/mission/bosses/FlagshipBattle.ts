import Phaser from 'phaser';
import { BOSS_TEX, FLAGSHIP_GRID } from '../../../art/bosses';
import { audio, speech } from '../../../core/services';
import type { Player } from '../../../entities/Player';
import type { Effects } from '../../../ui/effects';
import { BossBattle, type BossSlot } from './BossBattle';

const HOME = { x: 40, y: -230 };
const CANNON_X = [300, 980];
const CANNON_Y = 282;
const XWING_Y = 250;
const DOME_LANES = [430, 640, 850];
const DOME_Y = 280;

/**
 * Empire final boss: the rebel flagship. A cannon on each side and an X-wing in
 * the middle carry the answers. The last question puts three shield domes on
 * the hull, and the right one takes the final torpedo.
 */
export class FlagshipBattle extends BossBattle {
  private ship: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) {
    super(scene, fx, player, { label: 'Rebel Flagship', boltLaser: 'laser-red', totalHits });
    this.ship = scene.add
      .image(HOME.x, HOME.y - FLAGSHIP_GRID.h * FLAGSHIP_GRID.scale, BOSS_TEX.flagship)
      .setOrigin(0)
      .setScale(FLAGSHIP_GRID.scale)
      .setDepth(-50);
    this.body.push(this.ship);
  }

  intro(onDone: () => void): void {
    audio.play('whoosh');
    speech.speak('The rebel flagship! Knock out its cannons and the X-wings guarding it!');
    this.fx.banner('TARGET: REBEL FLAGSHIP!', '#ff6b6b', 360);
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

  slots(final: boolean): BossSlot[] {
    if (final) return DOME_LANES.map((x) => ({ x, y: DOME_Y, look: 'reactor', pattern: 'fixed' }));
    const [left, , right] = this.nudged([CANNON_X[0], 640, CANNON_X[1]]);
    return [
      { x: left, y: CANNON_Y, look: 'rebel-turret', pattern: 'fixed' },
      { x: 640, y: XWING_Y, look: 'xwing', pattern: 'bob' },
      { x: right, y: CANNON_Y, look: 'rebel-turret', pattern: 'fixed' },
    ];
  }

  override beginFinal(): void {
    this.fx.banner('FINAL SHOT!', '#7fe8ff', 360);
    speech.speak('Final shot! Fire the torpedo at the right shield dome!');
    this.scene.cameras.main.shake(700, 0.004);
  }

  protected victory(): { banner: string; speech: string } {
    return { banner: 'FLAGSHIP DISABLED!', speech: 'Direct hit! The rebel flagship is beaten!' };
  }
}
