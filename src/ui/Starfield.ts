import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';

/** Layered parallax deep-space background. */
export class Starfield {
  private layers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private nebula: Phaser.GameObjects.TileSprite;
  private streaks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Multiplier for scroll speed (e.g. warp effects). */
  speed = 1;
  /** Horizontal drift based on player movement, for extra parallax. */
  sway = 0;

  constructor(scene: Phaser.Scene, opts: { planet?: boolean } = {}) {
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x03040c).setOrigin(0).setDepth(-100);
    this.nebula = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEX.nebula)
      .setOrigin(0)
      .setDepth(-95)
      .setAlpha(0.9);
    if (opts.planet !== false) {
      scene.add.image(GAME_WIDTH - 180, 150, TEX.planet).setScale(3).setDepth(-92).setAlpha(0.85);
      scene.add.image(GAME_WIDTH - 330, 90, TEX.moon).setScale(1.5).setDepth(-91).setAlpha(0.8);
    }
    const defs: [string, number, number][] = [
      [TEX.starsFar, 18, 0.9],
      [TEX.starsMid, 45, 1],
      [TEX.starsNear, 110, 1],
    ];
    for (const [key, speed, alpha] of defs) {
      const sprite = scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0).setDepth(-90).setAlpha(alpha);
      this.layers.push({ sprite, speed });
    }
    // Occasional speed streaks for a sense of motion.
    this.streaks = scene.add.particles(0, 0, TEX.pixel, {
      x: { min: 0, max: GAME_WIDTH },
      y: -20,
      lifespan: 1400,
      speedY: { min: 600, max: 900 },
      scaleX: 0.25,
      scaleY: { min: 3, max: 6 },
      alpha: { start: 0.35, end: 0 },
      frequency: 140,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0x9fdcff, 0xffffff],
    });
    this.streaks.setDepth(-85);
  }

  update(dt: number): void {
    const s = dt / 1000;
    this.nebula.tilePositionY -= 6 * s * this.speed;
    this.nebula.tilePositionX += this.sway * 2 * s;
    for (const l of this.layers) {
      l.sprite.tilePositionY -= l.speed * s * this.speed;
      l.sprite.tilePositionX += this.sway * (l.speed / 30) * s;
    }
    this.streaks.frequency = this.speed > 3 ? 12 : 140;
  }
}
