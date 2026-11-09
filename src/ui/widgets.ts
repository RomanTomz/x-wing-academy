import Phaser from 'phaser';
import { COLORS, FONTS } from '../core/constants';
import { audio } from '../core/services';
import type { InputController } from '../input/InputController';

export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string = COLORS.text): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONTS.pixel,
      fontSize: `${size}px`,
      color,
      stroke: COLORS.stroke,
      strokeThickness: Math.max(4, Math.round(size / 4)),
      align: 'center',
    })
    .setOrigin(0.5);
}

export function roundText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string = COLORS.text,
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONTS.round,
      fontStyle: '600',
      fontSize: `${size}px`,
      color,
      stroke: COLORS.stroke,
      strokeThickness: Math.max(3, Math.round(size / 7)),
      align: 'center',
      ...opts,
    })
    .setOrigin(0.5);
}

/** Rounded, glowing holo-panel. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, color: number = COLORS.hud, alpha = 0.78): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(COLORS.panel, alpha);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.lineStyle(3, color, 0.9);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
  g.lineStyle(1, color, 0.35);
  g.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 10);
  return g;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private btnColor: number;
  private isFocused = false;
  private handler: () => void;
  isEnabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onPress: () => void, opts: { width?: number; height?: number; size?: number; color?: number } = {}) {
    super(scene, x, y);
    this.bw = opts.width ?? 360;
    this.bh = opts.height ?? 76;
    this.btnColor = opts.color ?? COLORS.hud;
    this.handler = onPress;
    this.bg = scene.add.graphics();
    this.label = pixelText(scene, 0, 2, text, opts.size ?? 22);
    this.add([this.bg, this.label]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => this.setFocused(true));
    this.on('pointerout', () => this.setFocused(false));
    this.on('pointerdown', () => this.press());
    this.draw();
    scene.add.existing(this);
  }

  setFocused(f: boolean): this {
    if (f && !this.isFocused) audio.play('click');
    this.isFocused = f;
    this.draw();
    this.setScale(f ? 1.06 : 1);
    return this;
  }

  /** Greyed-out, non-pressable state (e.g. a level locked by a parent). */
  setDisabled(disabled: boolean): this {
    this.isEnabled = !disabled;
    this.setAlpha(disabled ? 0.4 : 1);
    return this;
  }

  press(): void {
    if (!this.isEnabled) {
      audio.play('bump');
      return;
    }
    audio.unlock();
    audio.play('select');
    this.scene.tweens.add({ targets: this, scale: 0.94, duration: 70, yoyo: true });
    this.handler();
  }

  private draw(): void {
    const g = this.bg;
    const w = this.bw;
    const h = this.bh;
    g.clear();
    g.fillStyle(this.isFocused ? this.btnColor : COLORS.panel, this.isFocused ? 0.95 : 0.85);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.lineStyle(4, this.btnColor, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    if (this.isFocused) {
      g.lineStyle(2, 0xffffff, 0.8);
      g.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 12);
    }
    this.label.setColor(this.isFocused ? '#04101f' : COLORS.text);
    this.label.setStroke(this.isFocused ? '#ffffff' : COLORS.stroke, this.isFocused ? 0 : 6);
  }
}

/** Keyboard / gamepad focus navigation across a list of buttons. */
export class MenuNav {
  private buttons: Button[];
  private index: number;
  private input: InputController;
  private columns: number;

  constructor(input: InputController, buttons: Button[], opts: { start?: number; columns?: number } = {}) {
    this.input = input;
    this.buttons = buttons;
    this.columns = opts.columns ?? 1;
    this.index = opts.start ?? 0;
    this.buttons.forEach((b, i) => {
      b.on('pointerover', () => {
        this.index = i;
        this.refresh();
      });
    });
    this.refresh();
  }

  private refresh(): void {
    this.buttons.forEach((b, i) => b.setFocused(i === this.index));
  }

  update(): void {
    const n = this.buttons.length;
    if (n === 0) return;
    let moved = false;
    if (this.input.consume('down')) { this.index = (this.index + this.columns) % n; moved = true; }
    if (this.input.consume('up')) { this.index = (this.index - this.columns + n) % n; moved = true; }
    if (this.columns > 1) {
      if (this.input.consume('right')) { this.index = (this.index + 1) % n; moved = true; }
      if (this.input.consume('left')) { this.index = (this.index - 1 + n) % n; moved = true; }
    } else {
      this.input.consume('left');
      this.input.consume('right');
    }
    if (moved) this.refresh();
    if (this.input.consume('confirm')) this.buttons[this.index].press();
  }
}
