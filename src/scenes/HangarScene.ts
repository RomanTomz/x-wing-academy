import Phaser from 'phaser';
import { PIXEL_SCALE, shipTexture, TEX } from '../art/textures';
import { COLORS, FONTS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, store } from '../core/services';
import { InputController } from '../input/InputController';
import { unlocksOfKind, type Unlock, type UnlockKind } from '../progression/unlocks';
import { planetById } from '../progression/campaign';
import { Starfield } from '../ui/Starfield';
import { CRAFT, craftFor } from '../entities/Player';
import { Button, panel, pixelText, roundText } from '../ui/widgets';

interface Slot {
  unlock: Unlock;
  /** Ship pictures that follow the chosen starfighter / paint. */
  icon?: Phaser.GameObjects.Image;
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
}

const ROWS: { kind: UnlockKind; label: string }[] = [
  { kind: 'ship', label: 'STARFIGHTER' },
  { kind: 'paint', label: 'PAINT' },
  { kind: 'laser', label: 'LASERS' },
  { kind: 'trail', label: 'ENGINES' },
  { kind: 'droid', label: 'DROID' },
];

/** Ship customisation: paint, lasers, engine trail and droid buddy. */
export class HangarScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private slots: Slot[][] = [];
  private row = 0;
  private col = 0;
  private preview!: Phaser.GameObjects.Image;
  private droid!: Phaser.GameObjects.Image;
  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private info!: Phaser.GameObjects.Text;
  private t = 0;

  constructor() {
    super(SCENES.hangar);
  }

  create(): void {
    this.slots = [];
    this.row = 0;
    this.col = 0;
    this.t = 0;
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    pixelText(this, GAME_WIDTH / 2, 50, 'HANGAR', 40, COLORS.textGold);

    // Preview.
    panel(this, 270, 380, 420, 480, COLORS.hud, 0.6);
    const floor = this.add.graphics();
    floor.lineStyle(2, COLORS.hud, 0.35);
    for (let i = 0; i < 6; i++) floor.strokeEllipse(270, 520, 80 + i * 50, 20 + i * 12);
    this.trail = this.add.particles(0, 0, TEX.spark, {
      x: { min: -18, max: 18 },
      speedY: { min: 160, max: 260 },
      lifespan: 420,
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 14,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.preview = this.add.image(270, 360, TEX.ship('paint-red')).setScale(PIXEL_SCALE * 1.6);
    this.droid = this.add.image(150, 430, TEX.droid).setScale(PIXEL_SCALE * 1.3);
    this.trail.startFollow(this.preview, 0, 70);

    // Option grid.
    ROWS.forEach((r, ri) => {
      const y = 150 + ri * 112;
      this.add.text(540, y - 60, r.label, { fontFamily: FONTS.pixel, fontSize: '12px', color: COLORS.textDim });
      const items = unlocksOfKind(r.kind);
      const rowSlots: Slot[] = items.map((u, ci) => this.makeSlot(u, 582 + ci * 92, y + 6, ri, ci));
      this.slots.push(rowSlots);
    });

    this.info = roundText(this, 870, 680, '', 26, COLORS.text);
    new Button(this, 150, 668, 'BACK', () => this.leave(), { width: 200, height: 64, size: 18 });

    this.refresh();
  }

  private makeSlot(u: Unlock, x: number, y: number, ri: number, ci: number): Slot {
    const unlocked = store.isRewardUnlocked(u.id);
    const frame = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [frame];
    let icon: Phaser.GameObjects.Image | undefined;
    if (unlocked) {
      if (u.kind === 'ship') {
        icon = this.add.image(0, 0, TEX.ship(store.data.profile.equipped.paint, u.id)).setScale(1.55);
        parts.push(icon);
      } else if (u.kind === 'paint') {
        icon = this.add.image(0, 0, TEX.ship(u.id, store.data.profile.equipped.ship)).setScale(1.55);
        parts.push(icon);
      } else if (u.kind === 'laser') {
        parts.push(this.add.image(-10, 0, TEX.laser(u.id)).setScale(1.2).setAngle(20));
        parts.push(this.add.image(10, 0, TEX.laser(u.id)).setScale(1.2).setAngle(20));
      } else if (u.kind === 'trail') {
        const colors = u.id === 'trail-rainbow' ? [0xff4f4f, 0xffd23f, 0x4fff7a, 0x4fc3ff, 0xb84fff] : u.id === 'trail-comet' ? [0xffffff, 0xffd23f, 0xff6a2a] : [0xffffff, u.color, u.color];
        colors.forEach((c, i) => parts.push(this.add.circle(0, -24 + i * (48 / colors.length) + 4, 9 - i, c)));
      } else {
        parts.push(this.add.image(0, 0, TEX.droid).setScale(4));
      }
    } else {
      parts.push(this.add.image(0, -8, TEX.lock).setScale(3));
      parts.push(this.add.text(0, 26, u.boss ? 'Boss prize' : `Mission ${u.missions}`, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '15px', color: COLORS.textDim }).setOrigin(0.5));
    }
    const box = this.add.container(x, y, parts).setSize(88, 88).setInteractive({ useHandCursor: true });
    box.on('pointerover', () => {
      this.row = ri;
      this.col = ci;
      this.refresh();
    });
    box.on('pointerdown', () => this.choose());
    return { unlock: u, box, frame, icon };
  }

  private refresh(): void {
    const eq = store.data.profile.equipped;
    const missions = store.data.profile.missionsCompleted;
    this.slots.forEach((row, ri) =>
      row.forEach((s, ci) => {
        const focused = ri === this.row && ci === this.col;
        const u = s.unlock;
        const equipped = u.kind === 'droid' ? eq.droid : eq[u.kind] === u.id;
        const unlocked = store.isRewardUnlocked(u.id);
        const g = s.frame;
        g.clear();
        g.fillStyle(equipped ? 0x16405e : COLORS.panel, unlocked ? 0.95 : 0.6);
        g.fillRoundedRect(-44, -44, 88, 88, 14);
        g.lineStyle(focused ? 5 : 3, focused ? COLORS.gold : equipped ? COLORS.good : COLORS.hudDim, 1);
        g.strokeRoundedRect(-44, -44, 88, 88, 14);
        s.box.setScale(focused ? 1.06 : 1);
      }),
    );
    const focused = this.slots[this.row]?.[this.col]?.unlock;
    if (focused) {
      const unlocked = store.isRewardUnlocked(focused.id);
      const left = focused.missions - missions;
      this.info.setText(
        unlocked
          ? focused.kind === 'droid'
            ? `${focused.name}: ${eq.droid ? 'ON' : 'OFF'}`
            : focused.blurb
              ? `${focused.name}: ${focused.blurb}`
              : focused.name
          : focused.boss
            ? `${focused.name} — beat the ${planetById(focused.boss)?.name ?? 'boss'} to win it!`
            : `${focused.name} — fly ${left} more mission${left === 1 ? '' : 's'}!`,
      );
    }
    this.preview.setTexture(shipTexture(eq));
    for (const row of this.slots) {
      for (const slot of row) {
        if (slot.unlock.kind === 'ship') slot.icon?.setTexture(TEX.ship(eq.paint, slot.unlock.id));
        if (slot.unlock.kind === 'paint') slot.icon?.setTexture(TEX.ship(slot.unlock.id, eq.ship));
      }
    }
    this.droid.setVisible(eq.droid);
    const trail = unlocksOfKind('trail').find((u) => u.id === eq.trail);
    const tint =
      eq.trail === 'trail-rainbow' ? [0xff4f4f, 0xffb84f, 0xfff94f, 0x4fff7a, 0x4fc3ff, 0xb84fff] : eq.trail === 'trail-comet' ? [0xffffff, 0xffd23f, 0xff6a2a] : [0xffffff, trail?.color ?? 0x6fd3ff];
    this.trail.setConfig({
      x: { min: -18, max: 18 },
      speedY: { min: 160, max: 260 },
      lifespan: eq.trail === 'trail-blue' ? 420 : 620,
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 14,
      tint,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private choose(): void {
    const s = this.slots[this.row]?.[this.col];
    if (!s) return;
    if (!store.isRewardUnlocked(s.unlock.id)) {
      audio.play('bump');
      this.tweens.add({ targets: s.box, x: s.box.x + 6, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    store.equip(s.unlock.id);
    audio.play('select');
    this.tweens.add({ targets: this.preview, scale: PIXEL_SCALE * 1.8, duration: 120, yoyo: true });
    if (s.unlock.kind === 'laser' || s.unlock.kind === 'ship') this.fireDemo();
    this.refresh();
  }

  /** Show off the chosen ship's cannons with its chosen lasers. */
  private fireDemo(): void {
    const eq = store.data.profile.equipped;
    const profile = CRAFT[craftFor(eq)];
    const k = 1.6; // preview is drawn 1.6x bigger than in flight
    audio.play('laser');
    profile.volleys.forEach((volley, vi) => {
      this.time.delayedCall(vi * 160, () => {
        for (const [ox, oy] of volley) {
          const b = this.add
            .image(this.preview.x + ox * k, this.preview.y + oy * k, TEX.laser(eq.laser))
            .setScale(profile.laserScale[0] * 1.3, profile.laserScale[1] * 1.3)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: b, y: -60, duration: 450, onComplete: () => b.destroy() });
        }
      });
    });
  }

  private leave(): void {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.menu));
  }

  override update(_time: number, delta: number): void {
    this.t += delta / 1000;
    this.starfield.update(delta);
    this.preview.y = 360 + Math.sin(this.t * 1.5) * 12;
    this.preview.rotation = Math.sin(this.t * 0.9) * 0.08;
    this.droid.y = 440 + Math.sin(this.t * 2.6) * 10;
    this.input2.update();
    if (this.input2.consume('back')) {
      this.leave();
      return;
    }
    let moved = false;
    if (this.input2.consume('right')) { this.col++; moved = true; }
    if (this.input2.consume('left')) { this.col--; moved = true; }
    if (this.input2.consume('down')) { this.row = (this.row + 1) % this.slots.length; moved = true; }
    if (this.input2.consume('up')) { this.row = (this.row - 1 + this.slots.length) % this.slots.length; moved = true; }
    if (moved) {
      const len = this.slots[this.row].length;
      this.col = ((this.col % len) + len) % len;
      audio.play('click');
      this.refresh();
    }
    if (this.input2.consume('confirm')) this.choose();
  }
}
