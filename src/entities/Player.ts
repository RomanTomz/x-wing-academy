import Phaser from 'phaser';
import { PIXEL_SCALE, TEX } from '../art/textures';
import { GAME_WIDTH, PLAYER_MAX_Y, PLAYER_MIN_Y } from '../core/constants';
import { audio } from '../core/services';
import type { InputController } from '../input/InputController';
import type { Equipped } from '../persistence/saveData';
import { unlockById, type ShipId } from '../progression/unlocks';

export interface Laser {
  sprite: Phaser.GameObjects.Image;
  vy: number;
}

const ACCEL = 9; // responsiveness (higher = snappier)
const LASER_SPEED = 1250;

/** Which craft the player is flying. TIE is used only in the TIE Academy. */
export type Craft = ShipId | 'tie';

type Offset = readonly [number, number];

interface CraftProfile {
  texture: (e: Equipped) => string;
  scale: number;
  speed: number;
  cooldown: number;
  /** Cannon positions (screen px from the ship centre). Volleys alternate, one per shot. */
  volleys: readonly (readonly Offset[])[];
  engines: readonly Offset[];
  laserScale: Offset;
  laserOverride?: string;
}

/**
 * Each craft has a signature rather than being strictly better or worse:
 * the X-wing is quick, the Y-wing fires big blasts, the B-wing fires three at once.
 */
export const CRAFT: Record<Craft, CraftProfile> = {
  'x-wing': {
    texture: (e) => TEX.ship(e.paint, 'x-wing'),
    scale: PIXEL_SCALE,
    speed: 560,
    cooldown: 170,
    volleys: [
      [[-40, -48], [40, -48]],
      [[-52, -48], [52, -48]],
    ],
    engines: [[-12, 42], [12, 42]],
    laserScale: [1, 1.1],
  },
  'y-wing': {
    texture: (e) => TEX.ship(e.paint, 'y-wing'),
    scale: PIXEL_SCALE,
    speed: 500,
    cooldown: 230,
    volleys: [[[-10, -66], [10, -66]]],
    engines: [[-33, 62], [33, 62]],
    laserScale: [1.8, 1.4],
  },
  'b-wing': {
    texture: (e) => TEX.ship(e.paint, 'b-wing'),
    scale: PIXEL_SCALE,
    speed: 530,
    cooldown: 240,
    volleys: [[[-52, -36], [0, -70], [52, -36]]],
    engines: [[-9, 28], [9, 28]],
    laserScale: [1.1, 1.1],
  },
  tie: {
    texture: () => TEX.tiePlayer,
    scale: 2.3,
    speed: 610,
    cooldown: 160,
    volleys: [[[-11, -12], [11, -12]]],
    engines: [[-7, 10], [7, 10]],
    laserScale: [1, 1.1],
    laserOverride: 'laser-green',
  },
};

export function craftFor(equipped: Equipped): Craft {
  const s = equipped.ship;
  return s === 'y-wing' || s === 'b-wing' ? s : 'x-wing';
}

/** The player's starfighter: smooth flight, banking, lasers and engine trails. */
export class Player {
  readonly sprite: Phaser.GameObjects.Image;
  readonly lasers: Laser[] = [];
  private scene: Phaser.Scene;
  private profile: CraftProfile;
  private vx = 0;
  private vy = 0;
  private cooldown = 0;
  private volley = 0;
  private trails: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private glow: Phaser.GameObjects.Image;
  private laserKey: string;
  private laserColor: number;
  private shield: Phaser.GameObjects.Image;
  private bumpTimer = 0;
  private rollState = { t: 1 };
  private shadow: Phaser.GameObjects.Image | null = null;
  canFire = true;
  minY = PLAYER_MIN_Y;
  maxY = PLAYER_MAX_Y;

  constructor(scene: Phaser.Scene, x: number, y: number, equipped: Equipped, opts: { groundShadow?: boolean; craft?: Craft } = {}) {
    this.scene = scene;
    this.profile = CRAFT[opts.craft ?? craftFor(equipped)];
    const laserId = this.profile.laserOverride ?? equipped.laser;
    this.laserKey = TEX.laser(laserId);
    this.laserColor = unlockById(laserId)?.color ?? 0xff4a4a;

    const trailColor = opts.craft === 'tie' ? 0x9fe8ff : (unlockById(equipped.trail)?.color ?? 0x6fd3ff);
    const trailId = opts.craft === 'tie' ? 'trail-blue' : equipped.trail;
    const tint =
      trailId === 'trail-rainbow'
        ? [0xff4f4f, 0xffb84f, 0xfff94f, 0x4fff7a, 0x4fc3ff, 0xb84fff]
        : trailId === 'trail-comet'
          ? [0xffffff, 0xffd23f, 0xff6a2a, 0xff3b1f]
          : [0xffffff, trailColor, trailColor];
    for (let i = 0; i < this.profile.engines.length; i++) {
      const trail = scene.add.particles(0, 0, TEX.spark, {
        x: { min: -5, max: 5 },
        speedY: { min: 140, max: 260 },
        speedX: { min: -20, max: 20 },
        lifespan: trailId === 'trail-blue' ? 320 : 520,
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.9, end: 0 },
        frequency: 16,
        tint,
        blendMode: Phaser.BlendModes.ADD,
      });
      trail.setDepth(9);
      this.trails.push(trail);
    }

    this.glow = scene.add.image(x, y, TEX.flare).setTint(trailColor).setAlpha(0.5).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    const texture = this.profile.texture(equipped);
    if (opts.groundShadow) {
      // A shadow on the planet surface below sells the low-altitude flight.
      this.shadow = scene.add.image(x, y, texture).setScale(this.profile.scale * 0.8).setTintFill(0x000000).setAlpha(0.3).setDepth(1);
    }
    this.sprite = scene.add.image(x, y, texture).setScale(this.profile.scale).setDepth(10);
    this.shield = scene.add.image(x, y, TEX.shield).setScale(0.75).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(11);
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }

  /** Approximate collision radius for pickups and asteroids. */
  get radius(): number {
    return 40;
  }

  update(dt: number, input: InputController): void {
    const s = dt / 1000;
    let { x: mx, y: my } = input.move;

    // Optional mouse steering: hold the button and the ship glides towards the pointer.
    const pointer = this.scene.input.activePointer;
    if (input.pointerSteer && pointer.isDown && mx === 0 && my === 0) {
      const dx = pointer.worldX - this.sprite.x;
      const dy = pointer.worldY - 60 - this.sprite.y;
      mx = Phaser.Math.Clamp(dx / 120, -1, 1);
      my = Phaser.Math.Clamp(dy / 120, -1, 1);
    }

    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const k = Math.min(1, ACCEL * s);
    const maxSpeed = this.profile.speed;
    this.vx += (mx * maxSpeed - this.vx) * k;
    this.vy += (my * maxSpeed * 0.8 - this.vy) * k;

    if (this.bumpTimer > 0) this.bumpTimer -= dt;

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x + this.vx * s, 60, GAME_WIDTH - 60);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y + this.vy * s, this.minY, this.maxY);
    if (this.sprite.x <= 60 || this.sprite.x >= GAME_WIDTH - 60) this.vx *= 0.5;

    // Bank into turns.
    const bank = this.vx / maxSpeed;
    this.sprite.setRotation(bank * 0.16);
    const roll = this.rollState.t < 1 ? Math.cos(this.rollState.t * Math.PI * 4) : 1;
    const sc = this.profile.scale;
    this.sprite.setScale(sc * (1 - Math.abs(bank) * 0.12) * roll, sc);

    const cos = Math.cos(this.sprite.rotation);
    let gx = 0;
    let gy = 0;
    this.profile.engines.forEach(([ex, ey], i) => {
      const px = this.sprite.x + ex * cos * (1 - Math.abs(bank) * 0.12) - bank * 8;
      const py = this.sprite.y + ey;
      this.trails[i].setPosition(px, py);
      gx += px;
      gy += py;
    });
    const n = Math.max(1, this.profile.engines.length);
    this.glow.setPosition(gx / n, gy / n - 6).setScale(0.45 + Math.random() * 0.08 + Math.max(0, -this.vy / maxSpeed) * 0.25);
    this.shield.setPosition(this.sprite.x, this.sprite.y);
    this.shadow?.setPosition(this.sprite.x + 46, this.sprite.y + 60).setRotation(this.sprite.rotation);
    audio.setEngine(Math.min(1, Math.hypot(this.vx, this.vy) / maxSpeed));

    // Shooting.
    this.cooldown -= dt;
    if (this.canFire && input.fireHeld && this.cooldown <= 0) this.fire();

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.sprite.y += l.vy * s;
      if (l.sprite.y < -60) {
        l.sprite.destroy();
        this.lasers.splice(i, 1);
      }
    }
  }

  fire(): void {
    this.cooldown = this.profile.cooldown;
    // Volleys alternate (e.g. the X-wing's upper and lower cannon pairs).
    const volleys = this.profile.volleys;
    const offsets = volleys[this.volley % volleys.length];
    this.volley++;
    const cos = Math.cos(this.sprite.rotation);
    const squash = Math.abs(this.sprite.scaleX / this.profile.scale);
    const [lsx, lsy] = this.profile.laserScale;
    for (const [ox, oy] of offsets) {
      const x = this.sprite.x + ox * cos * squash;
      const y = this.sprite.y + oy;
      const sprite = this.scene.add.image(x, y, this.laserKey).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setScale(lsx, lsy);
      this.lasers.push({ sprite, vy: -LASER_SPEED });
      const flash = this.scene.add.image(x, y - 4, TEX.flare).setTint(this.laserColor).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(12);
      this.scene.tweens.add({ targets: flash, alpha: 0, scale: 0.5, duration: 90, onComplete: () => flash.destroy() });
    }
    audio.play('laser');
  }

  removeLaser(l: Laser): void {
    const i = this.lasers.indexOf(l);
    if (i >= 0) this.lasers.splice(i, 1);
    l.sprite.destroy();
  }

  /** Harmless knock (asteroids). Shields flash; nothing is lost. */
  bump(fromX: number, fromY: number): void {
    if (this.bumpTimer > 0) return;
    this.bumpTimer = 600;
    const ang = Math.atan2(this.sprite.y - fromY, this.sprite.x - fromX);
    this.vx += Math.cos(ang) * 500;
    this.vy += Math.sin(ang) * 500;
    this.shield.setAlpha(0.9);
    this.scene.tweens.add({ targets: this.shield, alpha: 0, duration: 500 });
    this.scene.cameras.main.shake(120, 0.004);
    audio.play('bump');
  }

  /** Celebratory barrel roll. */
  roll(): void {
    this.rollState.t = 0;
    this.scene.tweens.add({ targets: this.rollState, t: 1, duration: 700, ease: 'Sine.easeInOut' });
  }

  destroy(): void {
    for (const l of this.lasers) l.sprite.destroy();
    this.lasers.length = 0;
    for (const t of this.trails) t.destroy();
    this.glow.destroy();
    this.shield.destroy();
    this.shadow?.destroy();
    this.sprite.destroy();
  }
}
