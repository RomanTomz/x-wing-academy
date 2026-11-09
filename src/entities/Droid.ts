import Phaser from 'phaser';
import { PIXEL_SCALE, TEX } from '../art/textures';
import { audio } from '../core/services';
import { roundText } from '../ui/widgets';

const CHEERS = ['Bweep!', 'Woo-oo!', 'Beep boop!', 'Zwee!', 'Bip bip!'];

/** BIP-8: a little dome droid that follows the ship and cheers. */
export class Droid {
  private scene: Phaser.Scene;
  readonly sprite: Phaser.GameObjects.Image;
  private t = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.sprite = scene.add.image(x, y, TEX.droid).setScale(PIXEL_SCALE).setDepth(10);
  }

  update(dt: number, targetX: number, targetY: number): void {
    this.t += dt / 1000;
    const tx = targetX - 95;
    const ty = targetY + 30 + Math.sin(this.t * 3) * 8;
    const k = Math.min(1, (dt / 1000) * 4);
    this.sprite.x += (tx - this.sprite.x) * k;
    this.sprite.y += (ty - this.sprite.y) * k;
    this.sprite.rotation = Math.sin(this.t * 2) * 0.2;
  }

  cheer(): void {
    audio.play('beep');
    const txt = roundText(this.scene, this.sprite.x, this.sprite.y - 40, Phaser.Utils.Array.GetRandom(CHEERS), 24, '#9fd8ff').setDepth(30);
    this.scene.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 1200, ease: 'Quad.easeOut', onComplete: () => txt.destroy() });
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite.y - 30, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
