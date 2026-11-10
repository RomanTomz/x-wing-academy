import Phaser from 'phaser';
import { COLORS, FONTS } from '../core/constants';
import { audio } from '../core/services';
import type { HintPicture } from '../education/hintPictures';

/** Where the picture panel sits: just under the hint text. */
export const HINT_PICTURE = { x: 640, y: 248, w: 640, h: 92 } as const;

const HALF_W = 290;
const GOLD = 0xffd23f;
const BLUE = 0x4fc3ff;
const RED = 0xff6b5a;
const DIM = 0x2a3a55;

/**
 * Draws a hint picture (number line, ten-frame, bar, array, sharing, blocks,
 * fraction bar or pairs). `reveal` plays the method out step by step and shows
 * the answer; otherwise the answer is a "?".
 */
export class HintPictureView {
  private scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container | null = null;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const bg = scene.add.graphics();
    bg.fillStyle(0x08162a, 0.9);
    bg.fillRoundedRect(-HINT_PICTURE.w / 2, -HINT_PICTURE.h / 2, HINT_PICTURE.w, HINT_PICTURE.h, 16);
    bg.lineStyle(2, COLORS.hint, 0.7);
    bg.strokeRoundedRect(-HINT_PICTURE.w / 2, -HINT_PICTURE.h / 2, HINT_PICTURE.w, HINT_PICTURE.h, 16);
    this.root = scene.add.container(HINT_PICTURE.x, HINT_PICTURE.y, [bg]).setDepth(50).setAlpha(0);
  }

  get visible(): boolean {
    return this.root.alpha > 0 && this.body !== null;
  }

  show(pic: HintPicture, reveal: boolean): void {
    this.clear();
    this.body = this.scene.add.container(0, 0);
    this.root.add(this.body);
    this.scene.tweens.killTweensOf(this.root);
    this.root.setAlpha(1).setScale(0.9);
    this.scene.tweens.add({ targets: this.root, scale: 1, duration: 200, ease: 'Back.easeOut' });
    switch (pic.kind) {
      case 'numberline':
        return this.numberline(pic, reveal);
      case 'tenframe':
        return this.tenframe(pic, reveal);
      case 'bar':
        return this.bar(pic, reveal);
      case 'array':
        return this.array(pic, reveal);
      case 'share':
        return this.share(pic, reveal);
      case 'blocks':
        return this.blocks(pic, reveal);
      case 'fraction':
        return this.fraction(pic, reveal);
      case 'pairs':
        return this.pairs(pic);
    }
  }

  hide(): void {
    if (!this.body) return;
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({ targets: this.root, alpha: 0, duration: 180, onComplete: () => this.clear() });
  }

  destroy(): void {
    this.clear();
    this.root.destroy();
  }

  private clear(): void {
    for (const t of this.timers) t.remove();
    this.timers = [];
    this.body?.destroy();
    this.body = null;
  }

  // ------------------------------------------------------------- helpers

  private g(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    this.body?.add(g);
    return g;
  }

  private label(x: number, y: number, text: string, size = 18, color: string = COLORS.text): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: FONTS.round, fontStyle: '700', fontSize: `${size}px`, color, stroke: '#04101f', strokeThickness: 4 })
      .setOrigin(0.5);
    this.body?.add(t);
    return t;
  }

  /** Run `step(i)` for i = 0..n-1, one after another. */
  private sequence(n: number, gap: number, step: (i: number) => void, done?: () => void): void {
    for (let i = 0; i < n; i++) {
      this.timers.push(
        this.scene.time.delayedCall(250 + i * gap, () => {
          step(i);
          audio.play('tick');
        }),
      );
    }
    if (done) this.timers.push(this.scene.time.delayedCall(250 + n * gap, done));
  }

  private answer(x: number, y: number, value: number | string, reveal: boolean, delay = 0, size = 26): void {
    const t = this.label(x, y, reveal ? String(value) : '?', size, reveal ? '#ffd23f' : '#ff9a6a');
    if (reveal) {
      t.setScale(0);
      this.timers.push(
        this.scene.time.delayedCall(250 + delay, () => this.scene.tweens.add({ targets: t, scale: 1.2, duration: 260, ease: 'Back.easeOut' })),
      );
    }
  }

  // ------------------------------------------------------------- pictures

  private numberline(pic: Extract<HintPicture, { kind: 'numberline' }>, reveal: boolean): void {
    // Classroom-style lines: 0–10 or 0–20 for small numbers, otherwise rounded out to whole tens.
    const small = pic.min >= 0 && pic.max <= 20;
    const lo = small ? 0 : Math.floor(pic.min / 10) * 10;
    const hi = small ? (pic.max <= 10 ? 10 : 20) : Math.max(lo + 10, Math.ceil(pic.max / 10) * 10);
    const span = hi - lo;
    const left = -HALF_W + 24;
    const right = HALF_W - 24;
    const xOf = (v: number): number => left + ((v - lo) / span) * (right - left);
    const baseY = 12;
    const g = this.g();
    g.lineStyle(3, 0xcfe8ff, 1);
    g.lineBetween(left - 12, baseY, right + 12, baseY);
    // Ticks: every number on short lines, every ten on long ones (plus every hop point).
    const points = new Set<number>([pic.start, ...pic.hops.map((h) => h.to)]);
    if (span <= 20) for (let v = lo; v <= hi; v++) points.add(v);
    else for (let v = lo; v <= hi; v += 10) points.add(v);
    for (const v of points) {
      g.lineBetween(xOf(v), baseY - 5, xOf(v), baseY + 5);
    }
    const end = pic.hops.length ? pic.hops[pic.hops.length - 1].to : pic.start;
    // Number labels: the start, the tens on long lines, and (when revealed) where each hop lands.
    this.label(xOf(pic.start), baseY + 18, String(pic.start), 18, '#9fe8ff');
    // Landmark numbers (every 5 on short lines, every 10 on long ones), kept clear of the start and the answer.
    for (let v = lo; v <= hi; v += span <= 20 ? 5 : 10) {
      if (Math.abs(xOf(v) - xOf(pic.start)) > 22 && Math.abs(xOf(v) - xOf(end)) > 22) this.label(xOf(v), baseY + 18, String(v), 13, COLORS.textDim);
    }
    const arcs = this.g();
    const drawHop = (h: { from: number; to: number }, color: number, alpha: number): void => {
      const x0 = xOf(h.from);
      const x1 = xOf(h.to);
      const height = Math.min(34, 10 + Math.abs(x1 - x0) * 0.45);
      arcs.lineStyle(3, color, alpha);
      arcs.beginPath();
      for (let s = 0; s <= 16; s++) {
        const t = s / 16;
        const x = x0 + (x1 - x0) * t;
        const y = baseY - 4 - Math.sin(t * Math.PI) * height;
        if (s === 0) arcs.moveTo(x, y);
        else arcs.lineTo(x, y);
      }
      arcs.strokePath();
      const size = h.to - h.from;
      if (Math.abs(size) > 1) this.label((x0 + x1) / 2, baseY - 4 - height - 9, `${size > 0 ? '+' : '−'}${Math.abs(size)}`, 14, '#ffe9a8');
    };
    if (!reveal) {
      for (const h of pic.hops) drawHop(h, GOLD, 0.55);
      this.answer(xOf(end), baseY + 18, end, false);
      return;
    }
    this.sequence(pic.hops.length, Math.max(140, 1600 / pic.hops.length), (i) => {
      const h = pic.hops[i];
      drawHop(h, GOLD, 1);
      const room = Math.abs(xOf(h.to) - xOf(h.from)) > 20;
      if (i < pic.hops.length - 1 && room) this.label(xOf(h.to), baseY + 18, String(h.to), 13, COLORS.text);
    });
    this.answer(xOf(end), baseY + 18, end, true, pic.hops.length * Math.max(140, 1600 / pic.hops.length));
  }

  private tenframe(pic: Extract<HintPicture, { kind: 'tenframe' }>, reveal: boolean): void {
    const cell = 30;
    const frames = pic.size === 20 ? 2 : 1;
    const rows = pic.size === 5 ? 1 : 2;
    const frameW = 5 * cell;
    const gap = 24;
    const totalW = frames * frameW + (frames - 1) * gap;
    const x0 = -totalW / 2 - 50;
    const y0 = -(rows * cell) / 2;
    const g = this.g();
    const centre = (i: number): [number, number] => {
      const f = Math.floor(i / 10);
      const k = i % 10;
      return [x0 + f * (frameW + gap) + (k % 5) * cell + cell / 2, y0 + Math.floor(k / 5) * cell + cell / 2];
    };
    for (let f = 0; f < frames; f++) {
      g.lineStyle(2, 0x9fdcff, 0.9);
      for (let r = 0; r < rows; r++) for (let c = 0; c < 5; c++) g.strokeRect(x0 + f * (frameW + gap) + c * cell, y0 + r * cell, cell, cell);
    }
    for (let i = 0; i < pic.filled; i++) {
      const [x, y] = centre(i);
      g.fillStyle(RED, 1);
      g.fillCircle(x, y, 11);
    }
    const empty = pic.size - pic.filled;
    const sumX = x0 + totalW + 70;
    if (pic.ask === 'empty') {
      this.label(sumX, -16, `${pic.filled} + ? = ${pic.size}`, 22);
      if (!reveal) return this.answer(sumX, 14, empty, false);
      const counters = this.g();
      this.sequence(empty, 200, (i) => {
        const [x, y] = centre(pic.filled + i);
        counters.fillStyle(GOLD, 1);
        counters.fillCircle(x, y, 11);
        this.label(x, y, String(i + 1), 13, '#04101f').setStroke('#ffd23f', 0);
      });
      this.answer(sumX, 14, empty, true, empty * 200);
      return;
    }
    // Recognition: count the counters.
    if (!reveal) return this.answer(sumX, 0, pic.filled, false);
    this.sequence(pic.filled, 180, (i) => {
      const [x, y] = centre(i);
      this.label(x, y, String(i + 1), 13, '#ffffff');
    });
    this.answer(sumX, 0, pic.filled, true, pic.filled * 180);
  }

  private bar(pic: Extract<HintPicture, { kind: 'bar' }>, reveal: boolean): void {
    const [p1, p2] = pic.parts;
    const whole = pic.whole ?? (p1 ?? 0) + (p2 ?? 0);
    const a = p1 ?? whole - (p2 ?? 0);
    const w = HALF_W * 2 - 60;
    const left = -w / 2;
    const g = this.g();
    // Whole on top, the two parts underneath.
    g.fillStyle(0x1d4f7a, 1);
    g.fillRoundedRect(left, -38, w, 32, 6);
    g.lineStyle(2, 0x9fdcff, 1);
    g.strokeRoundedRect(left, -38, w, 32, 6);
    const aw = Math.max(60, Math.min(w - 60, (a / Math.max(1, whole)) * w));
    for (const [x, width, color] of [
      [left, aw, 0x2f6a3a],
      [left + aw, w - aw, 0x6a4a1d],
    ] as const) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x + 1, 4, width - 2, 32, 6);
      g.lineStyle(2, 0x9fdcff, 1);
      g.strokeRoundedRect(x + 1, 4, width - 2, 32, 6);
    }
    const missing = pic.whole === null ? whole : p1 === null ? whole - (p2 ?? 0) : whole - (p1 ?? 0);
    const put = (x: number, y: number, v: number | null): void => {
      if (v === null) this.answer(x, y, missing, reveal, 400);
      else this.label(x, y, String(v), 20);
    };
    put(0, -22, pic.whole);
    put(left + aw / 2, 20, p1);
    put(left + aw + (w - aw) / 2, 20, p2);
  }

  private array(pic: Extract<HintPicture, { kind: 'array' }>, reveal: boolean): void {
    // Draw the shorter side as rows so it fits the strip.
    const rows = Math.min(pic.rows, pic.cols);
    const cols = Math.max(pic.rows, pic.cols);
    const step = Math.min(24, 380 / cols, 76 / rows);
    const r = Math.max(4, step * 0.36);
    const x0 = -HALF_W + 30;
    const y0 = -((rows - 1) * step) / 2;
    const g = this.g();
    const totals: Phaser.GameObjects.Text[] = [];
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle(reveal ? DIM : BLUE, 1);
        g.fillCircle(x0 + c * step, y0 + row * step, r);
      }
    }
    const sumX = x0 + cols * step + 130;
    this.label(sumX, -18, `${rows} rows of ${cols}`, 20, COLORS.textDim);
    if (!reveal) return this.answer(sumX, 14, rows * cols, false);
    const lit = this.g();
    this.sequence(rows, 420, (row) => {
      for (let c = 0; c < cols; c++) {
        lit.fillStyle(GOLD, 1);
        lit.fillCircle(x0 + c * step, y0 + row * step, r);
      }
      totals.push(this.label(x0 + cols * step + 20, y0 + row * step, String((row + 1) * cols), 16, '#ffe9a8'));
    });
    this.answer(sumX, 14, rows * cols, true, rows * 420);
  }

  private share(pic: Extract<HintPicture, { kind: 'share' }>, reveal: boolean): void {
    const per = pic.total / pic.groups;
    const pileCols = Math.ceil(pic.total / 4);
    const step = Math.min(14, 150 / pileCols);
    const pileX = -HALF_W + 24;
    const dots: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < pic.total; i++) {
      const d = this.scene.add.circle(pileX + Math.floor(i / 4) * step, -24 + (i % 4) * 14, 5, BLUE);
      this.body?.add(d);
      dots.push(d);
    }
    const ringsLeft = -HALF_W + 200;
    const ringsW = HALF_W * 2 - 230;
    const ringStep = ringsW / pic.groups;
    const ringR = Math.min(30, ringStep / 2 - 3);
    const g = this.g();
    const ringX = (k: number): number => ringsLeft + ringStep * (k + 0.5);
    for (let k = 0; k < pic.groups; k++) {
      g.lineStyle(2, 0x9fdcff, 0.9);
      g.strokeCircle(ringX(k), -4, ringR);
    }
    this.label(pileX + 70, 32, `share ${pic.total} into ${pic.groups}`, 17, COLORS.textDim);
    if (!reveal) {
      this.answer(ringX(0), -4, per, false);
      return;
    }
    // Deal the dots out one at a time, like handing round sweets.
    const gap = Math.max(50, 2400 / pic.total);
    this.sequence(pic.total, gap, (i) => {
      const k = i % pic.groups;
      const slot = Math.floor(i / pic.groups);
      const a = (slot / Math.max(1, per)) * Math.PI * 2;
      const rr = per > 1 ? ringR * 0.55 : 0;
      this.scene.tweens.add({ targets: dots[i], x: ringX(k) + Math.cos(a) * rr, y: -4 + Math.sin(a) * rr, duration: 220, ease: 'Quad.easeOut' });
      dots[i].setFillStyle(GOLD);
    });
    for (let k = 0; k < pic.groups; k++) this.answer(ringX(k), 34, per, true, pic.total * gap, 20);
  }

  private blocks(pic: Extract<HintPicture, { kind: 'blocks' }>, reveal: boolean): void {
    const many = pic.numbers.length > 1;
    const centres = many ? [-150, 150] : [-40];
    pic.numbers.forEach((n, idx) => {
      const g = this.g();
      const cube = 5;
      const rodW = 9;
      const rodH = 10 * (cube + 1);
      const rodGap = many ? 4 : 7;
      const width = n.tens * (rodW + rodGap) + (n.ones > 0 ? 14 + Math.ceil(n.ones / 2) * 12 : 0);
      let x = centres[idx] - width / 2;
      const top = -36;
      for (let t = 0; t < n.tens; t++) {
        for (let k = 0; k < 10; k++) {
          g.fillStyle(BLUE, 1);
          g.fillRect(x, top + k * (cube + 1), rodW, cube);
        }
        x += rodW + rodGap;
      }
      x += 10;
      for (let i = 0; i < n.ones; i++) {
        g.fillStyle(GOLD, 1);
        g.fillRect(x + Math.floor(i / 2) * 12, top + rodH - (i % 2 === 0 ? 10 : 22), 10, 10);
      }
      const value = n.tens * 10 + n.ones;
      // When comparing, both numbers are in the question already; for tens and ones the counts are the point.
      if (many || reveal) this.label(centres[idx], 34, `${n.tens} ten${n.tens === 1 ? '' : 's'}, ${n.ones} one${n.ones === 1 ? '' : 's'}`, 16, COLORS.textDim);
      if (!many) {
        this.label(150, -10, reveal ? `${n.tens * 10} + ${n.ones}` : 'Count the tens,', reveal ? 20 : 16, reveal ? COLORS.text : COLORS.textDim);
        if (reveal) this.answer(150, 18, `= ${value}`, true, 300);
        else this.label(150, 14, 'then the ones', 16, COLORS.textDim);
      }
    });
    if (many) {
      const [l, r] = pic.numbers.map((n) => n.tens * 10 + n.ones);
      this.answer(0, -4, l < r ? '<' : l === r ? '=' : '>', reveal, 300, 30);
    }
  }

  private fraction(pic: Extract<HintPicture, { kind: 'fraction' }>, reveal: boolean): void {
    const w = 420;
    const left = -HALF_W + 20;
    const partW = w / pic.den;
    const part = pic.whole / pic.den;
    const g = this.g();
    this.label(left + w / 2, -32, `${pic.whole} altogether`, 15, COLORS.textDim);
    for (let k = 0; k < pic.den; k++) {
      g.fillStyle(k < pic.num ? 0x2f6a3a : 0x1d2f4a, 1);
      g.fillRect(left + k * partW, -16, partW, 40);
      g.lineStyle(2, 0x9fdcff, 1);
      g.strokeRect(left + k * partW, -16, partW, 40);
    }
    const sumX = left + w + 80;
    this.label(sumX, -16, `${pic.num} of ${pic.den} equal parts`, 14, COLORS.textDim);
    if (!reveal) {
      for (let k = 0; k < pic.den; k++) this.label(left + (k + 0.5) * partW, 4, '?', 18, '#ff9a6a');
      return this.answer(sumX, 14, (pic.whole * pic.num) / pic.den, false);
    }
    this.sequence(pic.den, 380, (k) => this.label(left + (k + 0.5) * partW, 4, String(part), 18, k < pic.num ? '#ffd23f' : COLORS.text));
    this.answer(sumX, 14, (pic.whole * pic.num) / pic.den, true, pic.den * 380);
  }

  private pairs(pic: Extract<HintPicture, { kind: 'pairs' }>): void {
    const cols = Math.ceil(pic.value / 2);
    const step = Math.min(26, 330 / Math.max(1, cols));
    const x0 = -HALF_W + 30;
    const g = this.g();
    for (let i = 0; i < pic.value; i++) {
      const col = Math.floor(i / 2);
      const row = i % 2;
      const leftover = pic.value % 2 === 1 && i === pic.value - 1;
      g.fillStyle(leftover ? RED : BLUE, 1);
      g.fillCircle(x0 + col * step, -14 + row * 26, 9);
    }
    // Pair outlines.
    g.lineStyle(2, 0x9fdcff, 0.6);
    for (let c = 0; c < Math.floor(pic.value / 2); c++) g.strokeRoundedRect(x0 + c * step - 11, -26, 22, 50, 10);
    const odd = pic.value % 2 === 1;
    const x = x0 + cols * step + 120;
    this.label(x, -12, odd ? 'One left over:' : 'All in pairs:', 16, COLORS.textDim);
    this.label(x, 14, `${pic.value} is ${odd ? 'ODD' : 'EVEN'}`, 22, odd ? '#ff9a6a' : '#5dff9a');
  }
}
