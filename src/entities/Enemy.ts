import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, FONTS } from '../core/constants';

export type EnemyPattern = 'sway' | 'figure8' | 'bob';
export type EnemyState = 'arriving' | 'active' | 'leaving' | 'dead';

/** What the target ships look like: enemy fighters normally, X-wings when the player flies a TIE. */
export type EnemyLook = 'tie' | 'xwing';

interface LookDef {
  texture: () => string;
  scale: number;
  angle: number;
  eye: boolean;
}

const LOOKS: Record<EnemyLook, LookDef> = {
  tie: { texture: () => TEX.enemy, scale: 2.6, angle: 0, eye: true },
  // Nose pointing down the screen, towards the player.
  xwing: { texture: () => TEX.ship('paint-red', 'x-wing'), scale: 2.5, angle: 180, eye: false },
};

/** Generous hit box (half-width) so aiming is forgiving — the challenge is the maths. */
const HIT_HALF_W = 92;
const HIT_TOP = -70;
const HIT_BOTTOM = 110;
/** How long the shield flash shows before a wrong target retreats. */
const RETREAT_DELAY = 550;

export interface EnemyOptions {
  value: number;
  /** Text on the plate (a number, or a symbol such as "<"). */
  label: string;
  isCorrect: boolean;
  homeX: number;
  homeY: number;
  pattern: EnemyPattern;
  delay: number;
  groundShadow?: boolean;
  look?: EnemyLook;
}

/** A target ship carrying an answer. */
export class Enemy {
  readonly container: Phaser.GameObjects.Container;
  readonly value: number;
  readonly isCorrect: boolean;
  state: EnemyState = 'arriving';
  private scene: Phaser.Scene;
  private ship: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private eye: Phaser.GameObjects.Image | null = null;
  private homeX: number;
  private homeY: number;
  private pattern: EnemyPattern;
  private phase: number;
  private t = 0;
  private knock = 0;
  private lockOn: Phaser.GameObjects.Graphics;
  private locked = false;
  private baseAngle: number;

  constructor(scene: Phaser.Scene, o: EnemyOptions) {
    this.scene = scene;
    this.value = o.value;
    this.isCorrect = o.isCorrect;
    this.homeX = o.homeX;
    this.homeY = o.homeY;
    this.pattern = o.pattern;
    this.phase = Math.random() * Math.PI * 2;
    const look = LOOKS[o.look ?? 'tie'];
    this.baseAngle = Phaser.Math.DegToRad(look.angle);

    this.shield = scene.add.image(0, 0, TEX.shield).setScale(1.05).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    this.ship = scene.add.image(0, 0, look.texture()).setScale(look.scale).setRotation(this.baseAngle);
    if (look.eye) {
      this.eye = scene.add.image(0, 2, TEX.flare).setScale(0.28).setTint(0xff3b5c).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
    }

    const plateW = Math.max(110, 46 * o.label.length + 44);
    const plate = scene.add.graphics({ x: 0, y: 84 });
    plate.fillStyle(0x04101f, 0.82);
    plate.fillRoundedRect(-plateW / 2, -38, plateW, 76, 20);
    plate.lineStyle(4, COLORS.hud, 1);
    plate.strokeRoundedRect(-plateW / 2, -38, plateW, 76, 20);
    const label = scene.add
      .text(0, 84, o.label, {
        fontFamily: FONTS.round,
        fontStyle: '700',
        fontSize: '64px',
        color: '#ffffff',
        stroke: '#04101f',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.lockOn = scene.add.graphics();
    this.drawLock();
    this.lockOn.setAlpha(0);

    const parts: Phaser.GameObjects.GameObject[] = [];
    if (o.groundShadow) {
      parts.push(
        scene.add.image(40, 70, look.texture()).setScale(look.scale * 0.75).setRotation(this.baseAngle).setTintFill(0x000000).setAlpha(0.28),
      );
    }
    parts.push(this.lockOn, this.shield, this.ship);
    if (this.eye) parts.push(this.eye);
    parts.push(plate, label);
    this.container = scene.add.container(o.homeX + Phaser.Math.Between(-120, 120), -180, parts);
    this.container.setDepth(5);

    scene.tweens.add({
      targets: this.container,
      x: o.homeX,
      y: o.homeY,
      duration: 1100,
      delay: o.delay,
      ease: 'Back.easeOut',
      onComplete: () => {
        if (this.state === 'arriving') this.state = 'active';
      },
    });
  }

  get x(): number {
    return this.container.x;
  }
  get y(): number {
    return this.container.y;
  }

  /** Can a laser interact with this enemy? */
  get targetable(): boolean {
    return this.state === 'active';
  }

  hitTest(x: number, y: number): boolean {
    const dx = x - this.container.x;
    const dy = y - this.container.y;
    return Math.abs(dx) <= HIT_HALF_W && dy >= HIT_TOP && dy <= HIT_BOTTOM;
  }

  /** Is the given x inside this enemy's aim column? (For the lock-on indicator.) */
  inAimColumn(x: number): boolean {
    return Math.abs(x - this.container.x) <= HIT_HALF_W;
  }

  setLocked(locked: boolean): void {
    if (locked === this.locked) return;
    this.locked = locked;
    this.scene.tweens.killTweensOf(this.lockOn);
    if (locked) {
      this.lockOn.setAlpha(1).setScale(1.25);
      this.scene.tweens.add({ targets: this.lockOn, scale: 1, duration: 160, ease: 'Quad.easeOut' });
    } else {
      this.scene.tweens.add({ targets: this.lockOn, alpha: 0, duration: 120 });
    }
  }

  private drawLock(): void {
    const g = this.lockOn;
    const w = 86;
    const h = 66;
    const c = 22;
    g.lineStyle(4, COLORS.gold, 0.95);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.moveTo(sx * w, sy * h + -sy * c);
      g.lineTo(sx * w, sy * h);
      g.lineTo(sx * w + -sx * c, sy * h);
      g.strokePath();
    }
  }

  update(dt: number): void {
    if (this.state === 'dead') return;
    this.t += dt / 1000;
    this.eye?.setAlpha(0.55 + Math.sin(this.t * 5 + this.phase) * 0.25);
    if (this.state !== 'active') return;

    const t = this.t * 0.9 + this.phase;
    let ox = 0;
    let oy = 0;
    switch (this.pattern) {
      case 'sway':
        ox = Math.sin(t) * 70;
        oy = Math.sin(t * 2) * 10;
        break;
      case 'figure8':
        ox = Math.sin(t) * 60;
        oy = Math.sin(t * 2) * 16;
        break;
      case 'bob':
        ox = Math.sin(t * 0.6) * 35;
        oy = Math.sin(t * 1.4) * 16;
        break;
    }
    this.knock *= Math.pow(0.02, dt / 1000);
    this.container.x = this.homeX + ox;
    this.container.y = this.homeY + oy - this.knock;
    this.ship.setRotation(this.baseAngle + Math.cos(t) * 0.06);
  }

  /**
   * Wrong answer: the shields flash, then the fighter retreats. It stops being a
   * target immediately, so a second laser already in flight can't count twice.
   */
  shieldHitAndRetreat(): void {
    this.state = 'leaving';
    this.setLocked(false);
    this.container.y -= 18;
    this.shield.setAlpha(1).setScale(1.2);
    this.scene.tweens.killTweensOf(this.shield);
    this.scene.tweens.add({ targets: this.shield, alpha: 0.4, scale: 1.05, duration: RETREAT_DELAY, ease: 'Quad.easeOut' });
    this.ship.setTintFill(0xbff6ff);
    this.scene.time.delayedCall(90, () => this.ship.clearTint());
    this.scene.time.delayedCall(RETREAT_DELAY, () => this.retreat());
  }

  /** The other targets leave once the right answer is found. */
  flyAway(): void {
    if (this.state === 'dead' || this.state === 'leaving') return;
    this.state = 'leaving';
    this.setLocked(false);
    this.retreat();
  }

  private retreat(): void {
    if (this.state === 'dead' || !this.container.active) return;
    const dir = this.container.x < 640 ? -1 : 1;
    this.scene.tweens.add({
      targets: this.container,
      y: -220,
      x: this.container.x + dir * 260,
      angle: dir * 25,
      duration: 900,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  /** Hide for explosion; the scene spawns the particle effects. */
  kill(): void {
    this.destroy();
  }

  destroy(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}
