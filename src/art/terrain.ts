import { createRng, type Rng } from '../education/rng';
import { PixelGrid } from './pixelGrid';

/**
 * Tileable procedural planet surfaces, drawn at low resolution and scaled up
 * as pixel art. Everything wraps at the edges so it can scroll forever.
 */

export const TERRAIN_SIZE = 128;

/** Value noise that wraps every `period` cells. */
function makeNoise(rng: Rng, period: number): (x: number, y: number) => number {
  const grid = Array.from({ length: period * period }, () => rng.next());
  const at = (i: number, j: number): number => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Fractal noise in 0..1 that tiles over TERRAIN_SIZE pixels. */
function fbm(rng: Rng): (x: number, y: number) => number {
  const octaves = [4, 8, 16, 32].map((period) => ({ period, n: makeNoise(rng, period) }));
  return (x, y) => {
    let sum = 0;
    let amp = 1;
    let total = 0;
    for (const o of octaves) {
      sum += o.n((x / TERRAIN_SIZE) * o.period, (y / TERRAIN_SIZE) * o.period) * amp;
      total += amp;
      amp *= 0.5;
    }
    return sum / total;
  };
}

function pick(shades: readonly string[], v: number): string {
  return shades[Math.max(0, Math.min(shades.length - 1, Math.floor(v * shades.length)))];
}

/** Run `draw` at the 9 wrapped offsets so shapes crossing an edge tile seamlessly. */
function wrapped(draw: (ox: number, oy: number) => void): void {
  for (const ox of [-TERRAIN_SIZE, 0, TERRAIN_SIZE]) for (const oy of [-TERRAIN_SIZE, 0, TERRAIN_SIZE]) draw(ox, oy);
}

function base(g: PixelGrid, noise: (x: number, y: number) => number, shades: readonly string[], contrast = 1.6): void {
  for (let y = 0; y < TERRAIN_SIZE; y++) {
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      const v = (noise(x, y) - 0.5) * contrast + 0.5;
      // Light ordered dither between shades for a 16-bit look.
      const d = ((x + y) & 1) * 0.04;
      g.set(x, y, pick(shades, v + d));
    }
  }
}

export function moonTerrain(): PixelGrid {
  const rng = createRng(501);
  const g = new PixelGrid(TERRAIN_SIZE, TERRAIN_SIZE);
  base(g, fbm(rng), ['#33374a', '#3d4256', '#474d62', '#52586e', '#5c637a']);
  for (let i = 0; i < 14; i++) {
    const cx = rng.next() * TERRAIN_SIZE;
    const cy = rng.next() * TERRAIN_SIZE;
    const r = 2.5 + rng.next() * (i < 3 ? 9 : 4);
    wrapped((ox, oy) => {
      g.circle(cx + ox, cy + oy, r + 1, '#6b7290');
      g.circle(cx + ox + 0.6, cy + oy + 0.6, r, '#2a2d3d');
      g.circle(cx + ox + 1.2, cy + oy + 1.2, r * 0.7, '#363a4e');
    });
  }
  return g;
}

export function frostTerrain(): PixelGrid {
  const rng = createRng(602);
  const g = new PixelGrid(TERRAIN_SIZE, TERRAIN_SIZE);
  const n = fbm(rng);
  base(g, n, ['#3f5a78', '#4b6888', '#587798', '#6788a8', '#7898b7'], 1.8);
  // Frozen lakes.
  for (let y = 0; y < TERRAIN_SIZE; y++)
    for (let x = 0; x < TERRAIN_SIZE; x++) if (n(x, y) < 0.36) g.set(x, y, (x + y) % 7 === 0 ? '#9cc8e6' : '#5f9cc6');
  // Ice cracks.
  for (let i = 0; i < 10; i++) {
    let x = rng.next() * TERRAIN_SIZE;
    let y = rng.next() * TERRAIN_SIZE;
    let a = rng.next() * Math.PI * 2;
    for (let s = 0; s < 26; s++) {
      const px = x;
      const py = y;
      wrapped((ox, oy) => g.set(px + ox, py + oy, '#b9dcf2'));
      a += (rng.next() - 0.5) * 0.9;
      x += Math.cos(a);
      y += Math.sin(a);
    }
  }
  // Snowy rocks.
  for (let i = 0; i < 8; i++) {
    const cx = rng.next() * TERRAIN_SIZE;
    const cy = rng.next() * TERRAIN_SIZE;
    const r = 2 + rng.next() * 3;
    wrapped((ox, oy) => {
      g.circle(cx + ox + 1, cy + oy + 1, r, '#2c3f56');
      g.circle(cx + ox, cy + oy, r, '#8eaac4');
      g.circle(cx + ox - 0.5, cy + oy - 0.8, r * 0.6, '#d6e8f5');
    });
  }
  return g;
}

export function duneTerrain(): PixelGrid {
  const rng = createRng(703);
  const g = new PixelGrid(TERRAIN_SIZE, TERRAIN_SIZE);
  const n = fbm(rng);
  const shades = ['#6e4526', '#82532e', '#975f34', '#a96d3d', '#b97c47'];
  for (let y = 0; y < TERRAIN_SIZE; y++) {
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      // Wind ripples: sine bands warped by noise. 8 full waves per tile so it wraps.
      const warp = n(x, y) * 3;
      const ripple = Math.sin(((y + Math.sin((x / TERRAIN_SIZE) * Math.PI * 2) * 4) / TERRAIN_SIZE) * Math.PI * 2 * 8 + warp);
      const v = n(x, y) * 0.65 + (ripple * 0.5 + 0.5) * 0.35;
      g.set(x, y, pick(shades, v));
    }
  }
  for (let i = 0; i < 9; i++) {
    const cx = rng.next() * TERRAIN_SIZE;
    const cy = rng.next() * TERRAIN_SIZE;
    const r = 1.5 + rng.next() * 2.5;
    wrapped((ox, oy) => {
      g.circle(cx + ox + 1.5, cy + oy + 1.5, r, '#5a3820');
      g.circle(cx + ox, cy + oy, r, '#6b5446');
      g.circle(cx + ox - 0.5, cy + oy - 0.5, r * 0.5, '#8a7262');
    });
  }
  return g;
}

export function forestTerrain(): PixelGrid {
  const rng = createRng(804);
  const g = new PixelGrid(TERRAIN_SIZE, TERRAIN_SIZE);
  g.rect(0, 0, TERRAIN_SIZE, TERRAIN_SIZE, '#0f2416');
  // A winding river.
  const river = makeNoise(rng, 4);
  for (let y = 0; y < TERRAIN_SIZE; y++) {
    const cx = 30 + river(0.5, (y / TERRAIN_SIZE) * 4) * 70;
    for (let x = 0; x < TERRAIN_SIZE; x++) {
      const d = Math.abs(x - cx);
      if (d < 5) g.set(x, y, d < 3 ? '#2b5f7a' : '#234d63');
    }
  }
  const greens = [
    ['#1d4a2a', '#2a6338', '#3a7d47'],
    ['#24552f', '#33703d', '#4a9152'],
    ['#2c5a26', '#3d7430', '#5a9440'],
  ];
  for (let i = 0; i < 150; i++) {
    const cx = rng.next() * TERRAIN_SIZE;
    const cy = rng.next() * TERRAIN_SIZE;
    const r = 3 + rng.next() * 4;
    const [dark, mid, light] = rng.pick(greens);
    wrapped((ox, oy) => {
      g.circle(cx + ox + 1.5, cy + oy + 1.5, r, '#0a1a10');
      g.circle(cx + ox, cy + oy, r, dark);
      g.circle(cx + ox - 0.6, cy + oy - 0.6, r * 0.75, mid);
      g.circle(cx + ox - 1.4, cy + oy - 1.4, r * 0.35, light);
    });
  }
  return g;
}

/** A small round planet for the galaxy map and briefings. */
export function planetSprite(kind: 'moon' | 'frost' | 'dune' | 'forest', size = 64): PixelGrid {
  const palettes: Record<typeof kind, { bands: string[]; dark: string; mid: string; spot?: string; cap?: string }> = {
    moon: { bands: ['#7d8399', '#8c92a8', '#9aa0b5', '#868ca2'], dark: '#2b2e3d', mid: '#4b4f63', spot: '#5f6479' },
    frost: { bands: ['#cfe6f7', '#a9cdea', '#e6f3fc', '#93bde0', '#cfe6f7'], dark: '#2b3f5c', mid: '#5d7fa6', cap: '#ffffff' },
    dune: { bands: ['#e0a35c', '#c98445', '#eab676', '#b8743a', '#d99550'], dark: '#4a2a14', mid: '#8a5226' },
    forest: { bands: ['#3f8f4f', '#2f7a43', '#4fa35a', '#2a6b3b', '#3f8f4f'], dark: '#0f2a18', mid: '#1f4d2b', spot: '#2b6f9a' },
  };
  const pal = palettes[kind];
  const rng = createRng(size + kind.length * 31);
  const g = new PixelGrid(size, size);
  const c = size / 2;
  const n = makeNoise(rng, 8);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      if (Math.hypot(dx, dy) > c - 1) continue;
      const wobble = n((x / size) * 8, (y / size) * 8) * 3;
      let col = pal.bands[Math.floor(((y + wobble) / size) * pal.bands.length) % pal.bands.length];
      if (pal.spot && n((x / size) * 8 + 3, (y / size) * 8 + 5) > 0.68) col = pal.spot;
      if (pal.cap && Math.abs(dy) > c * 0.72) col = pal.cap;
      const light = (-dx * 0.6 - dy * 0.5) / c + 0.35;
      const dither = ((x & 1) ^ (y & 1)) * 0.12;
      if (light + dither < -0.3) col = pal.dark;
      else if (light + dither < 0.0) col = pal.mid;
      g.set(x, y, col);
    }
  }
  if (kind === 'moon') {
    for (let i = 0; i < 7; i++) {
      const cx = c + (rng.next() - 0.5) * size * 0.6;
      const cy = c + (rng.next() - 0.5) * size * 0.6;
      const r = 2 + rng.next() * (size / 12);
      if (Math.hypot(cx - c, cy - c) + r < c - 2) {
        g.circle(cx, cy, r, '#6c7287');
        g.circle(cx + 0.7, cy + 0.7, r * 0.75, '#565b70');
      }
    }
  }
  g.outline('#0a0d18');
  return g;
}

export function starGrid(): PixelGrid {
  const g = new PixelGrid(17, 17);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 8.2 : 3.6;
    pts.push([8.5 + Math.cos(a) * r, 9 + Math.sin(a) * r]);
  }
  g.poly(pts, '#ffd23f');
  g.poly(pts.map(([x, y]) => [x - 0.6 + (x - 8.5) * -0.35, y - 0.6 + (y - 9) * -0.35] as [number, number]), '#fff2a8');
  g.outline('#3a2600');
  return g;
}

/** Space-station hull: metal plating, seams, vents, lights and a service trench. */
export function hullTerrain(): PixelGrid {
  const rng = createRng(905);
  const g = new PixelGrid(TERRAIN_SIZE, TERRAIN_SIZE);
  const shades = ['#353a44', '#3b414c', '#424854', '#4a505d'];
  const cell = 16;
  for (let cy = 0; cy < TERRAIN_SIZE; cy += cell) {
    for (let cx = 0; cx < TERRAIN_SIZE; cx += cell) {
      const split = rng.chance(0.3);
      const parts: [number, number, number, number][] = split
        ? [
            [cx, cy, cell / 2, cell / 2],
            [cx + cell / 2, cy, cell / 2, cell / 2],
            [cx, cy + cell / 2, cell / 2, cell / 2],
            [cx + cell / 2, cy + cell / 2, cell / 2, cell / 2],
          ]
        : [[cx, cy, cell, cell]];
      for (const [x, y, w, h] of parts) {
        g.rect(x, y, w, h, rng.pick(shades));
        g.rect(x, y, w, 1, '#22262e');
        g.rect(x, y, 1, h, '#22262e');
        g.rect(x + 1, y + 1, w - 1, 1, '#566070');
        if (!split && rng.chance(0.18)) {
          for (let k = 3; k < h - 2; k += 2) g.rect(x + 3, y + k, w - 6, 1, '#2a2e36');
        }
        if (rng.chance(0.12)) g.set(x + w - 3, y + 3, rng.chance(0.5) ? '#ff7a3d' : '#7fe8ff');
      }
    }
  }
  // Service trench running down the hull.
  const tx = 44;
  g.rect(tx, 0, 22, TERRAIN_SIZE, '#1b1e25');
  g.rect(tx, 0, 2, TERRAIN_SIZE, '#5f6878');
  g.rect(tx + 20, 0, 2, TERRAIN_SIZE, '#121419');
  for (let y = 0; y < TERRAIN_SIZE; y += 8) {
    g.rect(tx + 4, y, 14, 1, '#262a33');
    if (y % 32 === 0) g.set(tx + 10, y + 4, '#ffb347');
  }
  return g;
}

/** A wheel-shaped space station for the TIE Academy briefing and button. */
export function stationSprite(size = 64): PixelGrid {
  const g = new PixelGrid(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const light = ((c - x) * 0.6 + (c - y) * 0.5) / c;
      if (d <= c - 1 && d >= c - 8) g.set(x, y, light > 0.2 ? '#a3aab8' : light > -0.3 ? '#7f8796' : '#4f5664');
      else if (d < c - 8 && d >= c - 9.5) g.set(x, y, '#2e333d');
    }
  }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    for (let r = 9; r < c - 8; r++) {
      g.set(c + dx * r, c + dy * r, '#8d95a3');
      g.set(c + dx * r + (dy !== 0 ? 1 : 0), c + dy * r + (dx !== 0 ? 1 : 0), '#6c7381');
    }
  }
  g.circle(c, c, 9, '#7f8796');
  g.circle(c - 1, c - 1, 7, '#a3aab8');
  g.circle(c, c, 3, '#2e333d');
  g.circle(c, c, 1.5, '#7fe8ff');
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.set(c + Math.cos(a) * (c - 4.5), c + Math.sin(a) * (c - 4.5), i % 2 ? '#ffb347' : '#7fe8ff');
  }
  g.outline('#0a0d18');
  return g;
}
