import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { roundText, pixelText } from './widgets';

/** Shared particle effects for a scene. */
export class Effects {
  private scene: Phaser.Scene;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private glitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sparks = scene.add.particles(0, 0, TEX.spark, {
      speed: { min: 120, max: 520 },
      lifespan: { min: 400, max: 900 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xffe27a, 0xff9b3d, 0xff5a2a],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.debris = scene.add.particles(0, 0, TEX.pixel, {
      speed: { min: 80, max: 360 },
      lifespan: { min: 600, max: 1200 },
      scale: { min: 1, max: 2.4 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0 },
      gravityY: 220,
      tint: [0x8a93a6, 0x5b6476, 0xc35cff, 0x262c3d],
      emitting: false,
    });
    this.smoke = scene.add.particles(0, 0, TEX.flare, {
      speed: { min: 20, max: 90 },
      lifespan: 900,
      scale: { start: 0.4, end: 1.1 },
      alpha: { start: 0.35, end: 0 },
      tint: 0x8a5a3a,
      emitting: false,
    });
    this.glitter = scene.add.particles(0, 0, TEX.spark, {
      speed: { min: 60, max: 260 },
      lifespan: { min: 500, max: 1000 },
      scale: { start: 0.9, end: 0 },
      tint: [0x7fe8ff, 0xffffff, 0xffd23f],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    for (const e of [this.smoke, this.debris, this.sparks, this.glitter]) e.setDepth(20);
  }

  explosion(x: number, y: number, size = 1): void {
    this.smoke.explode(Math.round(10 * size), x, y);
    this.sparks.explode(Math.round(60 * size), x, y);
    this.debris.explode(Math.round(26 * size), x, y);
    const flash = this.scene.add.image(x, y, TEX.flare).setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setScale(0.5 * size).setTint(0xfff1c2);
    this.scene.tweens.add({ targets: flash, scale: 2.6 * size, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    const ring = this.scene.add.image(x, y, TEX.ring).setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setScale(0.2).setTint(0xffc65a);
    this.scene.tweens.add({ targets: ring, scale: 2.4 * size, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  rockBurst(x: number, y: number): void {
    this.smoke.explode(6, x, y);
    this.debris.explode(14, x, y);
    this.sparks.explode(10, x, y);
  }

  sparkle(x: number, y: number, count = 18): void {
    this.glitter.explode(count, x, y);
  }

  /** Small burst where a laser meets a shield. */
  impact(x: number, y: number): void {
    this.glitter.explode(10, x, y);
  }

  floatText(x: number, y: number, text: string, color = '#ffd23f', size = 34): void {
    const t = roundText(this.scene, x, y, text, size, color).setDepth(40);
    this.scene.tweens.add({ targets: t, y: y - 70, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  /** Big centre-screen celebration word. */
  banner(text: string, color = '#ffd23f', y = 400): void {
    const t = pixelText(this.scene, 640, y, text, 44, color).setDepth(45).setScale(0.3).setAlpha(0);
    this.scene.tweens.add({
      targets: t,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: 750, duration: 350, onComplete: () => t.destroy() });
      },
    });
  }
}
