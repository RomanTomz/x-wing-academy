import Phaser from 'phaser';
import { BOSS_TEX, DESTROYER_GRID } from '../../art/bosses';
import { TEX } from '../../art/textures';
import { COLORS, FONTS, GAME_WIDTH } from '../../core/constants';
import { audio, speech } from '../../core/services';
import type { Enemy } from '../../entities/Enemy';
import type { Player } from '../../entities/Player';
import type { Effects } from '../../ui/effects';

/** Where the destroyer sits once it has arrived (its top-left corner, in screen px). */
const HOME = { x: -160, y: -200 };
// Kept well inside the hull, which narrows towards the nose.
const LANES = [345, 640, 935];
const TURRET_Y = 262;
const BOLT_SPEED = 260;

interface Bolt {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}

/**
 * Boss battle: the player flies over a Star Destroyer's deck. Turbolaser turrets
 * rise out of the hull carrying answers; right answers blow them up. The boss
 * fires slow green bolts that only nudge the ship — there's still no way to lose.
 */
export class StarDestroyerBattle {
  private scene: Phaser.Scene;
  private fx: Effects;
  private player: Player;
  private ship: Phaser.GameObjects.Image;
  private hullBar: Phaser.GameObjects.Graphics;
  private hullLabel: Phaser.GameObjects.Text;
  private bolts: Bolt[] = [];
  private smoke: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private decals: Phaser.GameObjects.Image[] = [];
  private fireTimer = 2500;
  private hits = 0;
  private readonly totalHits: number;
  private jitter = 0;

  constructor(scene: Phaser.Scene, fx: Effects, player: Player, totalHits: number) {
    this.scene = scene;
    this.fx = fx;
    this.player = player;
    this.totalHits = totalHits;
    this.ship = scene.add
      .image(HOME.x, HOME.y - DESTROYER_GRID.h * DESTROYER_GRID.scale, BOSS_TEX.destroyer)
      .setOrigin(0)
      .setScale(DESTROYER_GRID.scale)
      .setDepth(-50);
    this.hullBar = scene.add.graphics().setDepth(52).setAlpha(0);
    this.hullLabel = scene.add
      .text(30, 112, 'STAR DESTROYER', { fontFamily: FONTS.pixel, fontSize: '10px', color: '#ff9a9a' })
      .setDepth(53)
      .setAlpha(0);
    this.drawHull();
  }

  /** The destroyer looms in from above. */
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
        this.scene.tweens.add({ targets: [this.hullBar, this.hullLabel], alpha: 1, duration: 300 });
        onDone();
      },
    });
  }

  /** Three turret positions for the next question, nudged so scorch marks don't stack. */
  slots(): { x: number; y: number }[] {
    this.jitter = (this.jitter + 1) % 3;
    const shift = [-25, 0, 25][this.jitter];
    return LANES.map((x, i) => ({ x: x + (i === 1 ? -shift : shift), y: TURRET_Y + (i === 1 ? 14 : 0) }));
  }

  onTurretDestroyed(x: number, y: number): void {
    this.hits = Math.min(this.totalHits, this.hits + 1);
    this.drawHull();
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
    // A couple of secondary blasts along the hull for drama.
    for (let i = 0; i < 2; i++) {
      this.scene.time.delayedCall(250 + i * 220, () => {
        this.fx.explosion(x + Phaser.Math.Between(-90, 90), y + Phaser.Math.Between(-40, 60), 0.6);
        audio.play('asteroid');
      });
    }
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
      .image(x, y, TEX.laser('laser-green'))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setScale(0.9, 0.8)
      .setRotation(angle + Math.PI / 2);
    this.bolts.push({ sprite, vx: Math.cos(angle) * BOLT_SPEED, vy: Math.sin(angle) * BOLT_SPEED });
    audio.play('laser');
  }

  /** Chain explosions, then the destroyer sinks away. */
  finale(onDone: () => void): void {
    for (const b of this.bolts) b.sprite.destroy();
    this.bolts = [];
    this.fx.banner('STAR DESTROYER DOWN!', COLORS.textGold, 360);
    speech.speak('You did it! The Star Destroyer is going down!');
    for (let i = 0; i < 14; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.fx.explosion(Phaser.Math.Between(200, 1080), Phaser.Math.Between(140, 440), Phaser.Math.FloatBetween(0.8, 1.6));
        audio.play('explosion');
        this.scene.cameras.main.shake(160, 0.008);
      });
    }
    this.scene.time.delayedCall(2200, () => {
      this.scene.cameras.main.flash(400, 255, 255, 255);
      this.scene.tweens.add({ targets: [this.ship, ...this.decals], y: '+=420', alpha: 0, duration: 1600, ease: 'Quad.easeIn' });
      for (const sm of this.smoke) sm.stop();
      this.scene.tweens.add({ targets: [this.hullBar, this.hullLabel], alpha: 0, duration: 400 });
    });
    this.scene.time.delayedCall(3600, onDone);
  }

  destroy(): void {
    for (const b of this.bolts) b.sprite.destroy();
    this.bolts = [];
    for (const sm of this.smoke) sm.destroy();
    this.smoke = [];
  }
}
