import Phaser from 'phaser';
import { BOSS_TEX } from '../../../art/bosses';
import { TEX } from '../../../art/textures';
import { THEME_TEX } from '../../../art/themes';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../../../core/constants';
import { audio, speech } from '../../../core/services';
import type { Enemy } from '../../../entities/Enemy';
import type { Player } from '../../../entities/Player';
import type { Effects } from '../../../ui/effects';
import { BossBattle, type BossSlot } from './BossBattle';

const CANNON_X = [300, 980];
const CANNON_Y = 282;
const TIE_Y = 250;
/** The trench for the final shot: walls slide in from both sides. */
const WALL_W = 250;
const PORT_LANES = [430, 640, 850];
const PORT_Y = 275;

/**
 * Rebel final boss. You skim the Death Star's surface: a cannon on each side and
 * a TIE fighter in the middle carry the answers. For the last question you dive
 * into the trench, and the right answer fires the proton torpedo into the
 * exhaust port.
 */
export class DeathStarBattle extends BossBattle {
  private walls: Phaser.GameObjects.TileSprite[] = [];
  private trenchFloor: Phaser.GameObjects.Rectangle | null = null;
  private station: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) {
    super(scene, fx, player, { label: 'Death Star', boltLaser: 'laser-green', totalHits });
    // The whole battle station, looming before you swoop down to the surface.
    this.station = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BOSS_TEX.icon('death-star')).setScale(16).setDepth(-40).setAlpha(0);
  }

  intro(onDone: () => void): void {
    audio.play('whoosh');
    speech.speak("That's no moon! It's the Death Star! Blast the cannons and the TIE fighters!");
    this.fx.banner('THE DEATH STAR!', '#ff6b6b', 360);
    this.scene.cameras.main.shake(2400, 0.003);
    this.station.setAlpha(1).setScale(4);
    // Zoom towards the surface until the station fills the view, then fade to the surface below.
    this.scene.tweens.add({
      targets: this.station,
      scale: 30,
      duration: 2400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.station,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            this.station.destroy();
            this.showHull();
            onDone();
          },
        });
      },
    });
  }

  slots(final: boolean): BossSlot[] {
    if (final) return PORT_LANES.map((x) => ({ x, y: PORT_Y, look: 'port', pattern: 'fixed' }));
    const [left, , right] = this.nudged([CANNON_X[0], 640, CANNON_X[1]]);
    return [
      { x: left, y: CANNON_Y, look: 'turret', pattern: 'fixed' },
      { x: 640, y: TIE_Y, look: 'tie', pattern: 'bob' },
      { x: right, y: CANNON_Y, look: 'turret', pattern: 'fixed' },
    ];
  }

  /** Dive into the trench for the final shot. */
  override beginFinal(): void {
    this.fx.banner('INTO THE TRENCH!', '#7fe8ff', 360);
    speech.speak('Into the trench! Use the proton torpedo. Find the right exhaust port!');
    this.scene.cameras.main.shake(900, 0.004);
    // Leave the surface (and its scorch marks) behind as you drop into the trench.
    this.stopSmoke();
    this.scene.tweens.add({ targets: this.decals, alpha: 0, duration: 500 });
    this.trenchFloor = this.scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - WALL_W * 2, GAME_HEIGHT, 0x0a0b0e, 0).setDepth(-60);
    this.scene.tweens.add({ targets: this.trenchFloor, fillAlpha: 0.55, duration: 800 });
    for (const side of [-1, 1]) {
      const x = side < 0 ? -WALL_W : GAME_WIDTH;
      const wall = this.scene.add
        .tileSprite(x, 0, WALL_W, GAME_HEIGHT, THEME_TEX.terrain('hull'))
        .setOrigin(0)
        .setTileScale(4)
        .setTint(side < 0 ? 0x9aa0aa : 0x6a707a)
        .setDepth(-55);
      this.walls.push(wall);
      this.scene.tweens.add({ targets: wall, x: side < 0 ? 0 : GAME_WIDTH - WALL_W, duration: 900, ease: 'Cubic.easeOut' });
    }
  }

  override update(dt: number, targets: readonly Enemy[], firing: boolean): void {
    super.update(dt, targets, firing);
    // Walls rush past as you fly down the trench.
    for (const w of this.walls) w.tilePositionY -= (dt / 1000) * 90;
  }

  protected victory(): { banner: string; speech: string } {
    return { banner: 'DEATH STAR DESTROYED!', speech: 'Great shot! The Death Star is destroyed! You saved the galaxy!' };
  }

  /** The station blows up behind you: flash, shockwave, and open space. */
  override finale(onDone: () => void): void {
    this.clearBolts();
    const v = this.victory();
    speech.speak(v.speech);
    for (let i = 0; i < 10; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        this.fx.explosion(Phaser.Math.Between(260, 1020), Phaser.Math.Between(160, 480), Phaser.Math.FloatBetween(1, 1.8));
        audio.play('explosion');
        this.scene.cameras.main.shake(140, 0.01);
      });
    }
    this.scene.time.delayedCall(1300, () => {
      this.scene.cameras.main.flash(900, 255, 255, 255);
      this.stopSmoke();
      this.hideHull();
      // Cover the surface with open space: the station is gone.
      this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03040c).setOrigin(0).setDepth(-45);
      this.scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEX.starsFar).setOrigin(0).setDepth(-44);
      this.scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEX.starsMid).setOrigin(0).setDepth(-44);
      for (const w of this.walls) w.setVisible(false);
      for (const d of this.decals) d.setVisible(false);
      const ring = this.scene.add.image(GAME_WIDTH / 2, 300, TEX.ring).setTint(0xffd9a0).setBlendMode(Phaser.BlendModes.ADD).setDepth(-43).setScale(0.3);
      this.scene.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 2200, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      const core = this.scene.add.image(GAME_WIDTH / 2, 300, TEX.flare).setTint(0xfff1c2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-43).setScale(1);
      this.scene.tweens.add({ targets: core, scale: 8, alpha: 0, duration: 1800, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
      const sparks = this.scene.add.particles(GAME_WIDTH / 2, 300, TEX.spark, {
        speed: { min: 200, max: 700 },
        lifespan: 1800,
        scale: { start: 1.5, end: 0 },
        tint: [0xffffff, 0xffd23f, 0xff8a3d],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      sparks.setDepth(-42);
      sparks.explode(160);
      audio.play('explosion');
      this.fx.banner(v.banner, COLORS.textGold, 360);
    });
    this.scene.time.delayedCall(4200, onDone);
  }

  override destroy(): void {
    super.destroy();
    this.trenchFloor = null;
    this.walls = [];
  }
}
