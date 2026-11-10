import Phaser from 'phaser';
import { PIXEL_SCALE, shipTexture, TEX } from '../art/textures';
import { COLORS, FONTS, SCENES } from '../core/constants';
import { audio, store } from '../core/services';
import { InputController } from '../input/InputController';
import { unlocksOfKind, type Unlock, type UnlockKind } from '../progression/unlocks';
import { planetById, type Faction } from '../progression/campaign';
import { Starfield } from '../ui/Starfield';
import { CRAFT, craftFor, trailTints } from '../entities/Player';
import { Button, panel, pixelText, roundText } from '../ui/widgets';

interface Slot {
  unlock: Unlock;
  /** Ship pictures that follow the chosen starfighter / paint. */
  icon?: Phaser.GameObjects.Image;
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  /** Slots shrink a little when a row has many items. */
  baseScale: number;
}

interface Tab {
  faction: Faction;
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

const GRID_LEFT = 582;
const GRID_RIGHT = 1236;
const ROW_TOP = 168;
const ROW_STEP = 112;
const BOX = 88;
const PREVIEW = { x: 270, y: 370 };

/**
 * Ship customisation for both sides. The tabs at the top switch between the
 * Rebel starfighter and the TIE; each has its own ship, paint and lasers, and
 * they share engines and the droid.
 */
export class HangarScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private faction: Faction = 'rebel';
  private tabs: Tab[] = [];
  private slots: Slot[][] = [];
  /** -1 = the side tabs; 0.. = the item rows. */
  private row = 0;
  private col = 0;
  private grid: Phaser.GameObjects.GameObject[] = [];
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
    this.tabs = [];
    this.grid = [];
    this.row = 0;
    this.col = 0;
    this.t = 0;
    this.faction = store.faction;
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    pixelText(this, PREVIEW.x, 50, 'HANGAR', 40, COLORS.textGold);

    // Side tabs.
    (['rebel', 'empire'] as const).forEach((f, i) => {
      const frame = this.add.graphics();
      const label = pixelText(this, 0, 0, f === 'rebel' ? 'REBEL' : 'EMPIRE', 16, COLORS.text);
      const helmet = this.add.image(-74, 0, f === 'rebel' ? TEX.helmet : TEX.helmetImperial).setScale(1.6);
      const box = this.add.container(760 + i * 260, 56, [frame, helmet, label]).setSize(230, 60).setInteractive({ useHandCursor: true });
      box.on('pointerover', () => {
        this.row = -1;
        this.col = i;
        this.refresh();
      });
      box.on('pointerdown', () => this.setSide(f));
      this.tabs.push({ faction: f, box, frame });
    });

    // Preview.
    panel(this, PREVIEW.x, PREVIEW.y + 10, 420, 480, COLORS.hud, 0.6);
    const floor = this.add.graphics();
    floor.lineStyle(2, COLORS.hud, 0.35);
    for (let i = 0; i < 6; i++) floor.strokeEllipse(PREVIEW.x, PREVIEW.y + 150, 80 + i * 50, 20 + i * 12);
    this.trail = this.add.particles(0, 0, TEX.spark, {
      x: { min: -18, max: 18 },
      speedY: { min: 160, max: 260 },
      lifespan: 420,
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 14,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.preview = this.add.image(PREVIEW.x, PREVIEW.y, shipTexture(store.loadout(this.faction))).setScale(PIXEL_SCALE * 1.6);
    this.droid = this.add.image(PREVIEW.x - 120, PREVIEW.y + 70, TEX.droid).setScale(PIXEL_SCALE * 1.3);

    this.info = roundText(this, 900, 682, '', 26, COLORS.text);
    new Button(this, 150, 668, 'BACK', () => this.leave(), { width: 200, height: 64, size: 18 });

    this.buildGrid();
    this.refresh();
  }

  /** Display scale for this side's ship in the preview. */
  private get previewScale(): number {
    return this.faction === 'empire' ? 5.2 : PIXEL_SCALE * 1.6;
  }

  private setSide(f: Faction): void {
    if (f === this.faction) return;
    this.faction = f;
    store.setFaction(f);
    audio.play('select');
    this.buildGrid();
    this.refresh();
  }

  private buildGrid(): void {
    for (const o of this.grid) o.destroy();
    this.grid = [];
    this.slots = [];
    ROWS.forEach((r, ri) => {
      const y = ROW_TOP + ri * ROW_STEP;
      this.grid.push(this.add.text(GRID_LEFT - 42, y - 63, r.label, { fontFamily: FONTS.pixel, fontSize: '12px', color: COLORS.textDim }));
      const items = unlocksOfKind(r.kind, this.faction);
      const step = items.length > 1 ? Math.min(92, (GRID_RIGHT - GRID_LEFT) / (items.length - 1)) : 92;
      const scale = Math.min(1, (step - 6) / BOX);
      this.slots.push(items.map((u, ci) => this.makeSlot(u, GRID_LEFT + ci * step, y, ri, ci, scale)));
    });
    this.trail.startFollow(this.preview, 0, this.faction === 'empire' ? 40 : 70);
  }

  private makeSlot(u: Unlock, x: number, y: number, ri: number, ci: number, baseScale: number): Slot {
    const unlocked = store.isRewardUnlocked(u.id);
    const frame = this.add.graphics();
    const parts: Phaser.GameObjects.GameObject[] = [frame];
    const loadout = store.loadout(this.faction);
    let icon: Phaser.GameObjects.Image | undefined;
    if (unlocked) {
      if (u.kind === 'ship') {
        icon = this.add.image(0, 0, shipTexture({ ship: u.id, paint: loadout.paint }));
        parts.push(icon);
      } else if (u.kind === 'paint') {
        icon = this.add.image(0, 0, shipTexture({ ship: loadout.ship, paint: u.id }));
        parts.push(icon);
      } else if (u.kind === 'laser') {
        parts.push(this.add.image(-10, 0, TEX.laser(u.id)).setScale(1.2).setAngle(20));
        parts.push(this.add.image(10, 0, TEX.laser(u.id)).setScale(1.2).setAngle(20));
      } else if (u.kind === 'trail') {
        const colors = trailTints(u.id);
        colors.forEach((c, i) => parts.push(this.add.circle(0, -24 + i * (48 / colors.length) + 4, 9 - i, c)));
      } else {
        parts.push(this.add.image(0, 0, TEX.droid).setScale(4));
      }
    } else {
      parts.push(this.add.image(0, -8, TEX.lock).setScale(3));
      parts.push(this.add.text(0, 26, u.boss ? 'Boss prize' : `Mission ${u.missions}`, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '15px', color: COLORS.textDim }).setOrigin(0.5));
    }
    icon?.setScale(Math.min(1.55, 70 / Math.max(icon.width, icon.height)));
    const box = this.add.container(x, y, parts).setSize(BOX, BOX).setScale(baseScale).setInteractive({ useHandCursor: true });
    box.on('pointerover', () => {
      this.row = ri;
      this.col = ci;
      this.refresh();
    });
    box.on('pointerdown', () => this.choose());
    this.grid.push(box);
    return { unlock: u, box, frame, icon, baseScale };
  }

  private isEquipped(u: Unlock): boolean {
    const l = store.loadout(this.faction);
    return u.kind === 'droid' ? l.droid : l[u.kind] === u.id;
  }

  private refresh(): void {
    const loadout = store.loadout(this.faction);
    const missions = store.data.profile.missionsCompleted;
    this.tabs.forEach((tab, i) => {
      const active = tab.faction === this.faction;
      const focused = this.row === -1 && this.col === i;
      const color = tab.faction === 'rebel' ? COLORS.gold : 0xff5a5a;
      const g = tab.frame;
      g.clear();
      g.fillStyle(active ? 0x16405e : COLORS.panel, active ? 0.95 : 0.6);
      g.fillRoundedRect(-115, -30, 230, 60, 14);
      g.lineStyle(focused ? 5 : 3, focused ? COLORS.gold : active ? color : COLORS.hudDim, 1);
      g.strokeRoundedRect(-115, -30, 230, 60, 14);
      tab.box.setScale(focused ? 1.06 : 1).setAlpha(active || focused ? 1 : 0.75);
    });
    this.slots.forEach((row, ri) =>
      row.forEach((s, ci) => {
        const focused = ri === this.row && ci === this.col;
        const equipped = this.isEquipped(s.unlock);
        const unlocked = store.isRewardUnlocked(s.unlock.id);
        const g = s.frame;
        g.clear();
        g.fillStyle(equipped ? 0x16405e : COLORS.panel, unlocked ? 0.95 : 0.6);
        g.fillRoundedRect(-BOX / 2, -BOX / 2, BOX, BOX, 14);
        g.lineStyle(focused ? 5 : 3, focused ? COLORS.gold : equipped ? COLORS.good : COLORS.hudDim, 1);
        g.strokeRoundedRect(-BOX / 2, -BOX / 2, BOX, BOX, 14);
        s.box.setScale(s.baseScale * (focused ? 1.06 : 1));
        if (s.unlock.kind === 'ship') s.icon?.setTexture(shipTexture({ ship: s.unlock.id, paint: loadout.paint }));
        if (s.unlock.kind === 'paint') s.icon?.setTexture(shipTexture({ ship: loadout.ship, paint: s.unlock.id }));
      }),
    );
    if (this.row === -1) {
      this.info.setText(this.col === 0 ? 'Rebel starfighters' : 'Imperial TIE fighters');
    } else {
      const focused = this.slots[this.row]?.[this.col]?.unlock;
      if (focused) {
        const unlocked = store.isRewardUnlocked(focused.id);
        const left = focused.missions - missions;
        this.info.setText(
          unlocked
            ? focused.kind === 'droid'
              ? `${focused.name}: ${loadout.droid ? 'ON' : 'OFF'}`
              : focused.blurb
                ? `${focused.name}: ${focused.blurb}`
                : focused.name
            : focused.boss
              ? `${focused.name}: beat the ${planetById(focused.boss)?.name ?? 'boss'} to win it!`
              : `${focused.name}: fly ${left} more mission${left === 1 ? '' : 's'}!`,
        );
      }
    }
    this.preview.setTexture(shipTexture(loadout)).setScale(this.previewScale);
    this.droid.setVisible(loadout.droid);
    this.trail.setConfig({
      x: { min: -18, max: 18 },
      speedY: { min: 160, max: 260 },
      lifespan: loadout.trail === 'trail-blue' ? 420 : 620,
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 14,
      tint: trailTints(loadout.trail),
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private choose(): void {
    if (this.row === -1) {
      this.setSide(this.tabs[this.col].faction);
      return;
    }
    const s = this.slots[this.row]?.[this.col];
    if (!s) return;
    if (!store.isRewardUnlocked(s.unlock.id)) {
      audio.play('bump');
      this.tweens.add({ targets: s.box, x: s.box.x + 6, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    store.equip(s.unlock.id, this.faction);
    audio.play('select');
    this.tweens.add({ targets: this.preview, scale: this.previewScale * 1.12, duration: 120, yoyo: true });
    if (s.unlock.kind === 'laser' || s.unlock.kind === 'ship') this.fireDemo();
    this.refresh();
  }

  /** Show off the chosen ship's cannons with its chosen lasers. */
  private fireDemo(): void {
    const loadout = store.loadout(this.faction);
    const profile = CRAFT[craftFor(loadout)];
    const k = this.previewScale / profile.scale; // the preview is bigger than in flight
    audio.play('laser');
    profile.volleys.forEach((volley, vi) => {
      this.time.delayedCall(vi * 160, () => {
        for (const [ox, oy] of volley) {
          const b = this.add
            .image(this.preview.x + ox * k, this.preview.y + oy * k, TEX.laser(loadout.laser))
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
    this.preview.y = PREVIEW.y + Math.sin(this.t * 1.5) * 12;
    this.preview.rotation = Math.sin(this.t * 0.9) * 0.08;
    this.droid.y = PREVIEW.y + 80 + Math.sin(this.t * 2.6) * 10;
    this.input2.update();
    if (this.input2.consume('back')) {
      this.leave();
      return;
    }
    let moved = false;
    const rows = this.slots.length;
    if (this.input2.consume('right')) { this.col++; moved = true; }
    if (this.input2.consume('left')) { this.col--; moved = true; }
    // Rows wrap through the side tabs (-1) at the top.
    if (this.input2.consume('down')) { this.row = this.row + 1 >= rows ? -1 : this.row + 1; moved = true; }
    if (this.input2.consume('up')) { this.row = this.row - 1 < -1 ? rows - 1 : this.row - 1; moved = true; }
    if (moved) {
      const len = this.row === -1 ? this.tabs.length : this.slots[this.row].length;
      this.col = ((this.col % len) + len) % len;
      audio.play('click');
      this.refresh();
    }
    if (this.input2.consume('confirm')) this.choose();
  }
}
