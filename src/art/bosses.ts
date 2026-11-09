import Phaser from 'phaser';
import { createRng } from '../education/rng';
import { PixelGrid, pointInPolygon, type Point } from './pixelGrid';

export const BOSS_TEX = {
  destroyer: 'boss-star-destroyer',
  turret: 'boss-turret',
  scorch: 'boss-scorch',
  icon: (id: string) => `boss-icon-${id}`,
} as const;

/** Grid size of the destroyer; it's drawn at 4x and is bigger than the screen on purpose. */
export const DESTROYER_GRID = { w: 400, h: 260, scale: 4 } as const;

const OUTLINE = '#0d1016';

/**
 * Star Destroyer seen from above, nose pointing down the screen towards the
 * player, so you fly over its deck. Original pixel art.
 */
function buildDestroyerGrid(): PixelGrid {
  const { w, h } = DESTROYER_GRID;
  const g = new PixelGrid(w, h);
  const rng = createRng(1977);
  const cx = w / 2;
  const hull: Point[] = [[0, 0], [w, 0], [cx + 2, h - 2], [cx - 2, h - 2]];
  const inHull = (x: number, y: number): boolean => pointInPolygon(x + 0.5, y + 0.5, hull);

  // Base plating with shading: lighter towards the spine, darker at the edges.
  for (let y = 0; y < h; y++) {
    const half = (w / 2) * (1 - y / h);
    for (let x = 0; x < w; x++) {
      if (!inHull(x, y)) continue;
      const edge = Math.abs(x - cx) / Math.max(1, half);
      const col = edge > 0.92 ? '#5b616d' : edge > 0.6 ? '#7d8491' : '#8d949f';
      g.set(x, y, col);
    }
  }
  // Panel patchwork.
  for (let i = 0; i < 420; i++) {
    const x = Math.floor(rng.next() * w);
    const y = Math.floor(rng.next() * h);
    const pw = 3 + Math.floor(rng.next() * 9);
    const ph = 2 + Math.floor(rng.next() * 5);
    const col = rng.pick(['#858c98', '#959ca8', '#767d8a', '#9ba2ad']);
    for (let yy = y; yy < y + ph; yy++) for (let xx = x; xx < x + pw; xx++) if (inHull(xx, yy) && inHull(xx + 2, yy) && inHull(xx - 2, yy)) g.set(xx, yy, col);
  }
  // Trench lines running parallel to the hull edges.
  for (const k of [0.35, 0.62, 0.82]) {
    for (let y = 0; y < h; y++) {
      const half = (w / 2) * (1 - y / h) * k;
      g.set(cx - half, y, '#5f6572');
      g.set(cx + half, y, '#5f6572');
    }
  }
  // Raised central spine.
  g.poly([[cx - 14, 20], [cx + 14, 20], [cx + 4, h - 20], [cx - 4, h - 20]], '#a3aab5');
  g.poly([[cx - 14, 20], [cx - 9, 20], [cx - 2, h - 20], [cx - 4, h - 20]], '#b8bec8');
  for (let y = 30; y < h - 30; y += 9) g.rect(cx - 6, y, 12, 1, '#7d8491');
  // Superstructure steps and bridge tower at the rear (top).
  g.rect(cx - 70, 4, 140, 26, '#7d8491');
  g.rect(cx - 70, 4, 140, 3, '#aab1bc');
  g.rect(cx - 44, 0, 88, 18, '#959ca8');
  g.rect(cx - 30, 0, 60, 10, '#b0b7c1');
  g.rect(cx - 52, 6, 104, 3, '#3d434e');
  g.circle(cx - 22, 6, 5, '#c4cad3');
  g.circle(cx + 22, 6, 5, '#c4cad3');
  // Decorative gun emplacements along the edges.
  for (let i = 0; i < 18; i++) {
    const t = 0.08 + i * 0.05;
    const y = t * h;
    const half = (w / 2) * (1 - t) * 0.9;
    for (const side of [-1, 1]) {
      g.circle(cx + side * half, y, 2, '#4a505b');
      g.set(cx + side * half, y - 1, '#c4cad3');
    }
  }
  // Running lights.
  for (let i = 0; i < 40; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    if (inHull(x, y) && inHull(x + 4, y) && inHull(x - 4, y)) g.set(x, y, rng.chance(0.5) ? '#ffe9a8' : '#9fdcff');
  }
  // Darken the plating (not the lights) so the player's ship and the turrets stand out.
  const lights = new Set(['#ffe9a8', '#9fdcff', '#c4cad3']);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g.get(x, y);
      if (!c || lights.has(c)) continue;
      const n = parseInt(c.slice(1), 16);
      const k = 0.74;
      const r = Math.round(((n >> 16) & 0xff) * k);
      const gg = Math.round(((n >> 8) & 0xff) * k);
      const b = Math.round((n & 0xff) * k);
      g.set(x, y, `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0')}`);
    }
  }
  // Engine glow on the rear edge.
  for (const ex of [-60, -20, 20, 60]) g.rect(cx + ex - 8, 0, 16, 2, '#9fe8ff');
  g.outline(OUTLINE);
  return g;
}

/** Turbolaser turret: round base, armoured dome and twin barrels pointing at the player. */
function buildTurretGrid(): PixelGrid {
  const g = new PixelGrid(24, 26);
  g.circle(12, 11, 11, '#3d434e');
  g.circle(12, 10.5, 10, '#6c7380');
  g.circle(12, 9.5, 7.5, '#9aa1ae');
  g.circle(11, 8.5, 4.5, '#b9c0ca');
  g.rect(8, 14, 2, 11, '#2c313a');
  g.rect(14, 14, 2, 11, '#2c313a');
  g.rect(8, 23, 2, 2, '#5dff7a');
  g.rect(14, 23, 2, 2, '#5dff7a');
  g.rect(9, 9, 6, 2, '#2c313a');
  g.outline(OUTLINE);
  return g;
}

/** Small wedge for the map and level picker. */
function buildDestroyerIcon(): PixelGrid {
  const g = new PixelGrid(56, 40);
  g.poly([[2, 2], [54, 2], [29, 38], [27, 38]], '#8d949f');
  g.poly([[24, 4], [32, 4], [29, 34], [27, 34]], '#b0b7c1');
  g.rect(18, 2, 20, 6, '#7d8491');
  g.rect(22, 0, 12, 4, '#b0b7c1');
  for (const x of [12, 44]) g.circle(x, 6, 1.5, '#4a505b');
  g.rect(14, 2, 6, 1, '#9fe8ff');
  g.rect(36, 2, 6, 1, '#9fe8ff');
  g.outline(OUTLINE);
  return g;
}

export function generateBossTextures(scene: Phaser.Scene): void {
  const add = (key: string, canvas: HTMLCanvasElement): void => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  add(BOSS_TEX.destroyer, buildDestroyerGrid().toCanvas());
  add(BOSS_TEX.turret, buildTurretGrid().toCanvas());
  add(BOSS_TEX.icon('star-destroyer'), buildDestroyerIcon().toCanvas());

  const scorch = document.createElement('canvas');
  scorch.width = 96;
  scorch.height = 96;
  const ctx = scorch.getContext('2d');
  if (ctx) {
    const grd = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
    grd.addColorStop(0, 'rgba(10,8,8,0.95)');
    grd.addColorStop(0.55, 'rgba(30,22,20,0.7)');
    grd.addColorStop(1, 'rgba(30,22,20,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 96, 96);
    const rng = createRng(66);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = rng.pick(['#ff8a2a', '#ffcf5a', '#ff5a2a']);
      ctx.fillRect(30 + rng.next() * 36, 30 + rng.next() * 36, 3, 3);
    }
  }
  add(BOSS_TEX.scorch, scorch);
}
