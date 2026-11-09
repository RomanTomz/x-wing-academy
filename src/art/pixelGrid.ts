/**
 * Tiny procedural pixel-art canvas. Shapes are rasterised onto a low-resolution
 * grid of colours, then outlined and turned into a canvas that Phaser scales up
 * with nearest-neighbour filtering — giving crisp 16-bit style sprites with no
 * external image files.
 */
export type Point = readonly [number, number];

export class PixelGrid {
  readonly width: number;
  readonly height: number;
  private cells: (string | null)[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array<string | null>(width * height).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.cells[y * this.width + x];
  }

  set(x: number, y: number, color: string | null): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    this.cells[yi * this.width + xi] = color;
  }

  rect(x: number, y: number, w: number, h: number, color: string): this {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++)
      for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, color);
    return this;
  }

  poly(points: readonly Point[], color: string): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (pointInPolygon(x + 0.5, y + 0.5, points)) this.set(x, y, color);
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, color: string): this {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) this.set(x, y, color);
      }
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.set(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), color);
    }
    return this;
  }

  /** Copy the left half onto the right half (for symmetric ships). */
  mirrorX(): this {
    const half = Math.floor(this.width / 2);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < half; x++) this.cells[y * this.width + (this.width - 1 - x)] = this.get(x, y);
    return this;
  }

  /** Add a 1px outline around every filled shape. */
  outline(color: string): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y) !== null) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, color);
    return this;
  }

  /** Recolour pixels matching `from` (for paint jobs). */
  replace(from: string, to: string): this {
    this.cells = this.cells.map((c) => (c === from ? to : c));
    return this;
  }

  clone(): PixelGrid {
    const g = new PixelGrid(this.width, this.height);
    g.cells = [...this.cells];
    return g;
  }

  toCanvas(scale = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return canvas;
  }
}

export function pointInPolygon(x: number, y: number, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Darken/lighten a 0xRRGGBB colour by a factor (0.5 = half brightness, 1.3 = lighter). */
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
