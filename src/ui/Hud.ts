import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import type { Question } from '../education/types';
import { roundText } from './widgets';

/** Cockpit HUD: question display, Mission Control messages, XP and progress. */
export class Hud {
  private scene: Phaser.Scene;
  private questionPanel: Phaser.GameObjects.Container;
  private instruction: Phaser.GameObjects.Text;
  private display: Phaser.GameObjects.Text;
  private blocks: Phaser.GameObjects.Graphics;
  private hint: Phaser.GameObjects.Text;
  private hintBg: Phaser.GameObjects.Graphics;
  private xpText: Phaser.GameObjects.Text;
  private shownXp = 0;
  private targetXp = 0;
  private pips: Phaser.GameObjects.Graphics;
  private comms: Phaser.GameObjects.Container;
  private commsText: Phaser.GameObjects.Text;
  private commsBg: Phaser.GameObjects.Graphics;
  private commsTimer: Phaser.Time.TimerEvent | null = null;
  readonly speakerButton: Phaser.GameObjects.Image;
  readonly pauseButton: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, rankName: string, opts: { imperial?: boolean } = {}) {
    this.scene = scene;
    this.drawCockpitFrame();

    // Question panel.
    const g = scene.add.graphics();
    g.fillStyle(COLORS.panel, 0.82);
    g.fillRoundedRect(-330, -62, 660, 124, 18);
    g.lineStyle(3, COLORS.hud, 0.95);
    g.strokeRoundedRect(-330, -62, 660, 124, 18);
    g.lineStyle(1, COLORS.hud, 0.3);
    g.strokeRoundedRect(-322, -54, 644, 108, 13);
    g.fillStyle(COLORS.hud, 0.9);
    g.fillTriangle(-330, -20, -342, 0, -330, 20);
    g.fillTriangle(330, -20, 342, 0, 330, 20);
    this.instruction = scene.add
      .text(0, -36, '', { fontFamily: FONTS.pixel, fontSize: '16px', color: COLORS.textDim })
      .setOrigin(0.5);
    this.display = roundText(scene, 0, 12, '', 66, '#ffffff', { fontStyle: '700', strokeThickness: 8 });
    this.blocks = scene.add.graphics();
    this.questionPanel = scene.add.container(GAME_WIDTH / 2, 76, [g, this.instruction, this.display, this.blocks]).setDepth(50);

    this.hintBg = scene.add.graphics().setDepth(50);
    this.hint = roundText(scene, GAME_WIDTH / 2, 172, '', 28, COLORS.textHint).setDepth(51);

    // XP readout.
    const xpPanel = scene.add.graphics().setDepth(50);
    xpPanel.fillStyle(COLORS.panel, 0.7);
    xpPanel.fillRoundedRect(18, 16, 250, 86, 12);
    xpPanel.lineStyle(2, COLORS.hud, 0.7);
    xpPanel.strokeRoundedRect(18, 16, 250, 86, 12);
    scene.add
      .text(36, 30, rankName.toUpperCase(), { fontFamily: FONTS.pixel, fontSize: rankName.length > 16 ? '9px' : '12px', color: COLORS.textDim })
      .setDepth(51);
    this.xpText = scene.add
      .text(36, 54, 'XP 0', { fontFamily: FONTS.pixel, fontSize: '24px', color: COLORS.textGold, stroke: COLORS.stroke, strokeThickness: 5 })
      .setDepth(51);

    // Progress pips + buttons.
    this.pips = scene.add.graphics().setDepth(50);
    this.speakerButton = scene.add.image(GAME_WIDTH - 130, 50, TEX.speaker).setDepth(52).setInteractive({ useHandCursor: true });
    this.pauseButton = scene.add.image(GAME_WIDTH - 60, 50, TEX.pause).setDepth(52).setInteractive({ useHandCursor: true });
    for (const b of [this.speakerButton, this.pauseButton]) {
      const ring = scene.add.circle(b.x, b.y, 30, COLORS.panel, 0.8).setStrokeStyle(3, COLORS.hud, 0.9).setDepth(51);
      b.on('pointerover', () => ring.setFillStyle(COLORS.hudDim, 0.9));
      b.on('pointerout', () => ring.setFillStyle(COLORS.panel, 0.8));
    }

    // Mission Control comms (bottom left).
    const cg = scene.add.graphics();
    this.commsBg = cg;
    const helmet = scene.add.image(40, 37, opts.imperial ? TEX.helmetImperial : TEX.helmet).setScale(2.4);
    const label = scene.add.text(80, 12, 'MISSION CONTROL', { fontFamily: FONTS.pixel, fontSize: '10px', color: COLORS.textDim });
    this.commsText = scene.add.text(80, 30, '', { fontFamily: FONTS.round, fontStyle: '600', fontSize: '26px', color: COLORS.text });
    this.comms = scene.add.container(20, GAME_HEIGHT - 96, [cg, helmet, label, this.commsText]).setDepth(55).setAlpha(0);
  }

  private drawCockpitFrame(): void {
    const g = this.scene.add.graphics().setDepth(48);
    const W = GAME_WIDTH;
    const H = GAME_HEIGHT;
    g.lineStyle(3, COLORS.hud, 0.35);
    const c = 46;
    for (const [x, y, sx, sy] of [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]]) {
      g.beginPath();
      g.moveTo(x, y + sy * c);
      g.lineTo(x, y);
      g.lineTo(x + sx * c, y);
      g.strokePath();
    }
    // Lower console struts.
    g.fillStyle(0x0b1a30, 0.55);
    g.fillTriangle(0, H, 0, H - 120, 150, H);
    g.fillTriangle(W, H, W, H - 120, W - 150, H);
    g.lineStyle(2, COLORS.hud, 0.3);
    g.lineBetween(0, H - 120, 150, H);
    g.lineBetween(W, H - 120, W - 150, H);
  }

  setQuestion(q: Question): void {
    this.instruction.setText(q.instruction.toUpperCase());
    this.display.setText(q.display);
    this.display.setFontSize(q.display.length > 18 ? 46 : q.display.length > 14 ? 54 : 66);
    this.drawBlocks(q.visual);
    this.questionPanel.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({ targets: this.questionPanel, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
    this.clearHint();
  }

  /** Base-ten blocks: tall rods of ten and single cubes, drawn inside the question panel. */
  private drawBlocks(visual: Question['visual']): void {
    const g = this.blocks;
    g.clear();
    if (!visual) return;
    const cube = 7;
    const gap = 1;
    const rodH = 10 * (cube + gap) - gap;
    const rodW = 14;
    const rodGap = 10;
    const onesSize = 15;
    const onesCols = Math.ceil(visual.ones / 2);
    const width = visual.tens * (rodW + rodGap) + (visual.ones > 0 ? 24 + onesCols * (onesSize + 4) : 0);
    let x = -width / 2;
    const top = -24;
    for (let t = 0; t < visual.tens; t++) {
      g.fillStyle(0x0b3a5a, 1);
      g.fillRect(x - 1, top - 1, rodW + 2, rodH + 2);
      for (let k = 0; k < 10; k++) {
        g.fillStyle(0x4fc3ff, 1);
        g.fillRect(x, top + k * (cube + gap), rodW, cube);
        g.fillStyle(0xbfeaff, 1);
        g.fillRect(x, top + k * (cube + gap), rodW, 1);
      }
      x += rodW + rodGap;
    }
    x += 16;
    for (let i = 0; i < visual.ones; i++) {
      const cx = x + Math.floor(i / 2) * (onesSize + 4);
      const cy = top + rodH - (i % 2 === 0 ? onesSize : 2 * onesSize + 4);
      g.fillStyle(0x7a5a00, 1);
      g.fillRect(cx - 1, cy - 1, onesSize + 2, onesSize + 2);
      g.fillStyle(0xffd23f, 1);
      g.fillRect(cx, cy, onesSize, onesSize);
      g.fillStyle(0xfff2b0, 1);
      g.fillRect(cx, cy, onesSize, 2);
    }
  }

  setBanner(instruction: string, display: string): void {
    this.blocks.clear();
    this.instruction.setText(instruction.toUpperCase());
    this.display.setText(display);
    this.display.setFontSize(46);
    this.questionPanel.setAlpha(1).setScale(1);
  }

  pulseQuestion(): void {
    this.scene.tweens.add({ targets: this.questionPanel, scale: 1.06, duration: 110, yoyo: true });
  }

  showHint(text: string): void {
    this.hint.setText(text).setAlpha(0).setY(176);
    this.hint.setWordWrapWidth(900);
    const b = this.hint.getBounds();
    this.hintBg.clear();
    this.hintBg.fillStyle(0x1a1200, 0.75);
    this.hintBg.fillRoundedRect(b.x - 18, 176 - b.height / 2 - 8, b.width + 36, b.height + 16, 14);
    this.hintBg.lineStyle(2, COLORS.hint, 0.8);
    this.hintBg.strokeRoundedRect(b.x - 18, 176 - b.height / 2 - 8, b.width + 36, b.height + 16, 14);
    this.hintBg.setAlpha(0);
    this.scene.tweens.add({ targets: [this.hint, this.hintBg], alpha: 1, duration: 200 });
  }

  clearHint(): void {
    this.scene.tweens.add({ targets: [this.hint, this.hintBg], alpha: 0, duration: 200 });
  }

  /** Short Mission Control message in the comms panel. */
  say(text: string, ms = 2600): void {
    this.commsText.setText(text);
    const w = Math.max(320, this.commsText.width + 104);
    this.commsBg.clear();
    this.commsBg.fillStyle(COLORS.panel, 0.88);
    this.commsBg.fillRoundedRect(0, 0, w, 74, 14);
    this.commsBg.lineStyle(2, COLORS.hud, 0.8);
    this.commsBg.strokeRoundedRect(0, 0, w, 74, 14);
    this.scene.tweens.killTweensOf(this.comms);
    this.comms.setAlpha(1).setX(-20);
    this.scene.tweens.add({ targets: this.comms, x: 20, duration: 200, ease: 'Quad.easeOut' });
    this.commsTimer?.remove();
    this.commsTimer = this.scene.time.delayedCall(ms, () => {
      this.scene.tweens.add({ targets: this.comms, alpha: 0, duration: 300 });
    });
  }

  setXp(xp: number): void {
    this.targetXp = xp;
  }

  setProgress(done: number, total: number, current: number): void {
    const g = this.pips;
    g.clear();
    const size = total > 10 ? 12 : 18;
    const gap = 5;
    const width = total * size + (total - 1) * gap;
    const x0 = GAME_WIDTH - 24 - width;
    const y = 104;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * (size + gap);
      if (i < done) {
        g.fillStyle(COLORS.good, 1);
        g.fillRoundedRect(x, y, size, size, 4);
      } else if (i === current - 1) {
        g.fillStyle(COLORS.gold, 0.9);
        g.fillRoundedRect(x, y, size, size, 4);
      } else {
        g.fillStyle(COLORS.panel, 0.8);
        g.fillRoundedRect(x, y, size, size, 4);
        g.lineStyle(2, COLORS.hud, 0.6);
        g.strokeRoundedRect(x, y, size, size, 4);
      }
    }
  }

  update(dt: number): void {
    if (this.shownXp !== this.targetXp) {
      const step = Math.max(1, Math.ceil(Math.abs(this.targetXp - this.shownXp) * Math.min(1, dt / 120)));
      this.shownXp = this.shownXp < this.targetXp ? Math.min(this.targetXp, this.shownXp + step) : this.targetXp;
      this.xpText.setText(`XP ${this.shownXp}`);
    }
  }

  get questionPanelObject(): Phaser.GameObjects.Container {
    return this.questionPanel;
  }
}
