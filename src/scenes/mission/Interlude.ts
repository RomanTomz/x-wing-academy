import Phaser from 'phaser';
import { ASTEROID_VARIANTS, TEX } from '../../art/textures';
import { GAME_HEIGHT, GAME_WIDTH } from '../../core/constants';
import type { InterludeKind } from '../../progression/mission';
import type { Player } from '../../entities/Player';

interface Falling {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  spin: number;
  radius: number;
  kind: 'crystal' | 'asteroid';
}

export interface InterludeCallbacks {
  onCrystal(x: number, y: number): void;
  onAsteroidDestroyed(x: number, y: number): void;
  onBump(x: number, y: number): void;
  onDone(): void;
}

const SPAWN_MS = 13000;

/** A short, pressure-free flying section between questions. */
export class Interlude {
  private scene: Phaser.Scene;
  private kind: InterludeKind;
  private player: Player;
  private cb: InterludeCallbacks;
  private items: Falling[] = [];
  private elapsed = 0;
  private nextSpawn = 600;
  private nextCrystalInField = 1500;
  private formation = 0;
  private done = false;
  private tints: { asteroid: number; crystal: number };

  constructor(scene: Phaser.Scene, kind: InterludeKind, player: Player, tints: { asteroid: number; crystal: number }, cb: InterludeCallbacks) {
    this.scene = scene;
    this.tints = tints;
    this.kind = kind;
    this.player = player;
    this.cb = cb;
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const s = dt / 1000;

    if (this.elapsed < SPAWN_MS) {
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0) {
        if (this.kind === 'crystals') {
          this.spawnCrystalFormation();
          this.nextSpawn = 1500;
        } else {
          this.spawnAsteroid();
          this.nextSpawn = Phaser.Math.Between(650, 1000);
        }
      }
      if (this.kind === 'asteroids') {
        this.nextCrystalInField -= dt;
        if (this.nextCrystalInField <= 0) {
          this.spawnCrystal(Phaser.Math.Between(140, GAME_WIDTH - 140), -40);
          this.nextCrystalInField = 1700;
        }
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.sprite.x += it.vx * s;
      it.sprite.y += it.vy * s;
      it.sprite.rotation += it.spin * s;
      if (it.kind === 'crystal') it.sprite.setScale(2.6 + Math.sin(this.elapsed / 150 + i) * 0.25, 2.6);

      const dist = Phaser.Math.Distance.Between(it.sprite.x, it.sprite.y, this.player.x, this.player.y);
      if (it.kind === 'crystal' && dist < this.player.radius + it.radius + 14) {
        this.cb.onCrystal(it.sprite.x, it.sprite.y);
        this.remove(i);
        continue;
      }
      if (it.kind === 'asteroid') {
        if (dist < this.player.radius + it.radius - 10) {
          this.cb.onBump(it.sprite.x, it.sprite.y);
          it.vy *= 0.5;
          it.vx += (it.sprite.x - this.player.x) * 2;
        }
        // Lasers break asteroids.
        let hit = false;
        for (const l of [...this.player.lasers]) {
          if (Phaser.Math.Distance.Between(l.sprite.x, l.sprite.y, it.sprite.x, it.sprite.y) < it.radius + 10) {
            this.player.removeLaser(l);
            hit = true;
            break;
          }
        }
        if (hit) {
          this.cb.onAsteroidDestroyed(it.sprite.x, it.sprite.y);
          this.remove(i);
          continue;
        }
      }
      if (it.sprite.y > GAME_HEIGHT + 80 || it.sprite.x < -100 || it.sprite.x > GAME_WIDTH + 100) this.remove(i);
    }

    if (this.elapsed >= SPAWN_MS && (this.items.length === 0 || this.elapsed > SPAWN_MS + 4000)) {
      this.finish();
    }
  }

  private spawnCrystal(x: number, y: number): void {
    const sprite = this.scene.add.image(x, y, TEX.crystal).setScale(2.6).setDepth(6).setTint(this.tints.crystal);
    const glow = this.scene.add.image(x, y, TEX.flare).setScale(0.6).setTint(0x5ff2ff).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    sprite.setData('glow', glow);
    this.items.push({ sprite, vx: 0, vy: 230, spin: 0, radius: 22, kind: 'crystal' });
  }

  private spawnCrystalFormation(): void {
    const f = this.formation++ % 4;
    const cx = Phaser.Math.Between(260, GAME_WIDTH - 260);
    for (let k = 0; k < 5; k++) {
      let x = cx;
      let y = -40 - k * 70;
      if (f === 1) x = cx + Math.sin(k * 0.9) * 120; // snake
      if (f === 2) { x = cx + (k - 2) * 80; y = -40 - Math.abs(k - 2) * 60; } // V
      if (f === 3) { x = cx + (k - 2) * 90; y = -40; } // line
      this.spawnCrystal(x, y);
    }
  }

  private spawnAsteroid(): void {
    const scale = Phaser.Math.FloatBetween(2.2, 3.6);
    const sprite = this.scene.add
      .image(Phaser.Math.Between(80, GAME_WIDTH - 80), -60, TEX.asteroid(Phaser.Math.Between(0, ASTEROID_VARIANTS - 1)))
      .setScale(scale)
      .setDepth(6)
      .setTint(this.tints.asteroid);
    this.items.push({
      sprite,
      vx: Phaser.Math.Between(-60, 60),
      vy: Phaser.Math.Between(170, 290),
      spin: Phaser.Math.FloatBetween(-1.5, 1.5),
      radius: 13 * scale,
      kind: 'asteroid',
    });
  }

  private remove(i: number): void {
    const it = this.items[i];
    const glow = it.sprite.getData('glow') as Phaser.GameObjects.Image | undefined;
    glow?.destroy();
    it.sprite.destroy();
    this.items.splice(i, 1);
  }

  /** Keep crystal glows attached (called after update). */
  syncGlows(): void {
    for (const it of this.items) {
      const glow = it.sprite.getData('glow') as Phaser.GameObjects.Image | undefined;
      glow?.setPosition(it.sprite.x, it.sprite.y);
    }
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.destroy();
    this.cb.onDone();
  }

  destroy(): void {
    for (let i = this.items.length - 1; i >= 0; i--) this.remove(i);
  }
}
