import Phaser from 'phaser';
import { BOSS_TEX } from '../../../art/bosses';
import { TEX } from '../../../art/textures';
import { COLORS, FONTS, GAME_WIDTH } from '../../../core/constants';
import { audio, speech } from '../../../core/services';
import type { Enemy, EnemyLook, EnemyPattern } from '../../../entities/Enemy';
import type { Player } from '../../../entities/Player';
import type { Effects } from '../../../ui/effects';

/** Where one answer target appears in a boss battle, and what it looks like. */
export interface BossSlot {
  x: number;
  y: number;
  look: EnemyLook;
  pattern: EnemyPattern;
}

interface Bolt {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}

const BOLT_SPEED = 260;

export interface BossOptions {
  /** Name on the hull bar. */
  label: string;
  /** Colour of the boss's bolts (green for the Empire, red for the Rebels). */
  boltLaser: string;
  totalHits: number;
}

/**
 * Shared boss mechanics: a health bar, slow bolts that only nudge the ship (there's
 * still no way to lose), scorch marks and smoke where targets fall, the optional
 * final torpedo shot and a chain-explosion finale. Each boss supplies its own art,
 * target layout and words.
 */
export abstract class BossBattle {
  protected scene: Phaser.Scene;
  protected fx: Effects;
  protected player: Player;
  protected readonly totalHits: number;
  protected hits = 0;
  /** Big objects that sink away in the finale (the boss itself, scorch marks). */
  protected body: Phaser.GameObjects.Image[] = [];
  protected decals: Phaser.GameObjects.Image[] = [];
  private hullBar: Phaser.GameObjects.Graphics;
  private hullLabel: Phaser.GameObjects.Text;
  private bolts: Bolt[] = [];
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private fireTimer = 2500;
  private boltLaser: string;
  private jitter = 0;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, o: BossOptions) {
    this.scene = scene;
    this.fx = fx;
    this.player = player;
    this.totalHits = o.totalHits;
    this.boltLaser = o.boltLaser;
    this.hullBar = scene.add.graphics().setDepth(52).setAlpha(0);
    this.hullLabel = scene.add
      .text(30, 112, o.label.toUpperCase(), { fontFamily: FONTS.pixel, fontSize: o.label.length > 16 ? '8px' : '10px', color: '#ff9a9a' })
      .setDepth(53)
      .setAlpha(0);
    this.drawHull();
  }

  /** The boss arrives; call `onDone` when the first question can start. */
  abstract intro(onDone: () => void): void;

  /** Target positions and looks for the next question. */
  abstract slots(final: boolean): BossSlot[];

  /** Final bosses: set the scene for the decisive last question. */
  beginFinal(): void {
    /* only final bosses do something here */
  }

  protected abstract victory(): { banner: string; speech: string };

  /** Fade in the health bar (subclasses call this at the end of their intro). */
  protected showHull(): void {
    this.scene.tweens.add({ targets: [this.hullBar, this.hullLabel], alpha: 1, duration: 300 });
  }

  /** Spread three lane positions a little each question so scorch marks don't stack. */
  protected nudged(lanes: readonly number[]): number[] {
    this.jitter = (this.jitter + 1) % 3;
    const shift = [-25, 0, 25][this.jitter];
    return lanes.map((x, i) => x + (i === 1 ? -shift : shift));
  }

  /** A right answer: damage the boss and leave a mark. */
  onTargetDestroyed(x: number, y: number, scorch = true): void {
    this.hits = Math.min(this.totalHits, this.hits + 1);
    this.drawHull();
    if (scorch) {
      const decal = this.scene.add.image(x, y + 6, BOSS_TEX.scorch).setDepth(-49).setRotation(Math.random() * Math.PI);
      this.decals.push(decal);
      const smoke = this.scene.add.particles(x, y, TEX.flare, {
        speedY: { min: -40, max: -15 },
        speedX: { min: -12, max: 12 },
        lifespan: 1600,
        scale: { start: 0.15, end: 0.5 },
        alpha: { start: 0.35, end: 0 },
        tint: 0x55504c,
        frequency: 220,
      });
      smoke.setDepth(-48);
      this.smoke.push(smoke);
    }
    // A couple of secondary blasts nearby for drama.
    for (let i = 0; i < 2; i++) {
      this.scene.time.delayedCall(250 + i * 220, () => {
        this.fx.explosion(x + Phaser.Math.Between(-90, 90), y + Phaser.Math.Between(-40, 60), 0.6);
        audio.play('asteroid');
      });
    }
  }

  /** The decisive shot: a glowing torpedo streaks from the ship into the target. */
  finalShot(toX: number, toY: number, onImpact: () => void): void {
    const fromX = this.player.x;
    const fromY = this.player.y - 50;
    const glow = this.scene.add.image(fromX, fromY, TEX.flare).setTint(0x9fdcff).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
    const core = this.scene.add.image(fromX, fromY, TEX.flare).setTint(0xffffff).setScale(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(13);
    const trail = this.scene.add.particles(0, 0, TEX.spark, {
      lifespan: 400,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xffffff, 0x9fdcff],
      frequency: 10,
      blendMode: Phaser.BlendModes.ADD,
    });
    trail.startFollow(core).setDepth(11);
    audio.play('whoosh');
    this.scene.tweens.add({
      targets: [glow, core],
      x: toX,
      y: toY,
      duration: 750,
      ease: 'Quad.easeIn',
      onComplete: () => {
        glow.destroy();
        core.destroy();
        trail.stop();
        this.scene.time.delayedCall(500, () => trail.destroy());
        this.fx.explosion(toX, toY, 2);
        this.scene.cameras.main.shake(400, 0.012);
        audio.play('explosion');
        onImpact();
      },
    });
  }

  private drawHull(): void {
    const g = this.hullBar;
    const w = 232;
    const left = 1 - this.hits / this.totalHits;
    g.clear();
    g.fillStyle(0x1a0606, 0.85);
    g.fillRoundedRect(18, 106, w + 18, 40, 10);
    g.lineStyle(2, 0xff6b6b, 0.8);
    g.strokeRoundedRect(18, 106, w + 18, 40, 10);
    g.fillStyle(0x3a1212, 1);
    g.fillRoundedRect(27, 126, w, 12, 6);
    if (left > 0) {
      g.fillStyle(0xff4a4a, 1);
      g.fillRoundedRect(27, 126, Math.max(12, w * left), 12, 6);
    }
  }

  update(dt: number, targets: readonly Enemy[], firing: boolean): void {
    const s = dt / 1000;
    if (firing) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = Phaser.Math.Between(1900, 3200);
        const shooters = targets.filter((t) => t.state === 'active');
        if (shooters.length > 0) this.fire(Phaser.Utils.Array.GetRandom(shooters));
      }
    } else {
      // Give the pilot a moment to read each new question before shots start.
      this.fireTimer = Math.max(this.fireTimer, 1600);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.sprite.x += b.vx * s;
      b.sprite.y += b.vy * s;
      if (Phaser.Math.Distance.Between(b.sprite.x, b.sprite.y, this.player.x, this.player.y) < 36) {
        this.player.bump(b.sprite.x, b.sprite.y);
        this.fx.impact(b.sprite.x, b.sprite.y);
        b.sprite.destroy();
        this.bolts.splice(i, 1);
        continue;
      }
      if (b.sprite.y > 760 || b.sprite.x < -40 || b.sprite.x > GAME_WIDTH + 40) {
        b.sprite.destroy();
        this.bolts.splice(i, 1);
      }
    }
  }

  private fire(from: Enemy): void {
    const x = from.x;
    const y = from.y + 30;
    const angle = Math.atan2(this.player.y - y, this.player.x - x);
    const sprite = this.scene.add
      .image(x, y, TEX.laser(this.boltLaser))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setScale(0.9, 0.8)
      .setRotation(angle + Math.PI / 2);
    this.bolts.push({ sprite, vx: Math.cos(angle) * BOLT_SPEED, vy: Math.sin(angle) * BOLT_SPEED });
    audio.play('laser');
  }

  protected clearBolts(): void {
    for (const b of this.bolts) b.sprite.destroy();
    this.bolts = [];
  }

  protected stopSmoke(): void {
    for (const sm of this.smoke) sm.stop();
  }

  protected hideHull(): void {
    this.scene.tweens.add({ targets: [this.hullBar, this.hullLabel], alpha: 0, duration: 400 });
  }

  /** Chain explosions, a flash, then the boss sinks away. */
  finale(onDone: () => void): void {
    this.clearBolts();
    const v = this.victory();
    this.fx.banner(v.banner, COLORS.textGold, 360);
    speech.speak(v.speech);
    for (let i = 0; i < 14; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.fx.explosion(Phaser.Math.Between(200, 1080), Phaser.Math.Between(140, 440), Phaser.Math.FloatBetween(0.8, 1.6));
        audio.play('explosion');
        this.scene.cameras.main.shake(160, 0.008);
      });
    }
    this.scene.time.delayedCall(2200, () => {
      this.scene.cameras.main.flash(400, 255, 255, 255);
      this.scene.tweens.add({ targets: [...this.body, ...this.decals], y: '+=420', alpha: 0, duration: 1600, ease: 'Quad.easeIn' });
      this.stopSmoke();
      this.hideHull();
    });
    this.scene.time.delayedCall(3600, onDone);
  }

  destroy(): void {
    this.clearBolts();
    for (const sm of this.smoke) sm.destroy();
    this.smoke = [];
  }
}
