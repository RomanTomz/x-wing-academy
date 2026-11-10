import Phaser from 'phaser';
import { createRng } from '../education/rng';
import { PixelGrid, pointInPolygon, type Point } from './pixelGrid';

export const BOSS_TEX = {
  destroyer: 'boss-star-destroyer',
  turret: 'boss-turret',
  scorch: 'boss-scorch',
  generator: 'boss-generator',
  flagship: 'boss-flagship',
  rebelTurret: 'boss-rebel-turret',
  port: 'boss-port',
  reactor: 'boss-reactor',
  icon: (id: string) => `boss-icon-${id}`,
} as const;

/** Grid size of the rebel flagship (drawn at 4x, like the destroyer). */
export const FLAGSHIP_GRID = { w: 300, h: 240, scale: 4 } as const;

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
  darken(g, 0.74, new Set(['#ffe9a8', '#9fdcff', '#c4cad3']));
  // Engine glow on the rear edge.
  for (const ex of [-60, -20, 20, 60]) g.rect(cx + ex - 8, 0, 16, 2, '#9fe8ff');
  g.outline(OUTLINE);
  return g;
}

/** Multiply every colour except `keep` by k (to push big backdrops behind the action). */
function darken(g: PixelGrid, k: number, keep: ReadonlySet<string>): void {
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const c = g.get(x, y);
      if (!c || keep.has(c)) continue;
      const n = parseInt(c.slice(1), 16);
      const r = Math.round(((n >> 16) & 0xff) * k);
      const gg = Math.round(((n >> 8) & 0xff) * k);
      const b = Math.round((n & 0xff) * k);
      g.set(x, y, `#${((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0')}`);
    }
  }
}

/**
 * Rebel flagship seen from above, nose towards the player: a rounded, organic
 * hull with bulging pods and blue engines at the rear. Original pixel art.
 */
function buildFlagshipGrid(): PixelGrid {
  const { w, h } = FLAGSHIP_GRID;
  const g = new PixelGrid(w, h);
  const rng = createRng(1983);
  const cx = w / 2;
  // Half-width at each row: a wide rounded stern tapering to a blunt nose.
  const half = (y: number): number => {
    const t = y / h;
    if (t < 0.45) return (w / 2 - 6) * Math.sqrt(1 - Math.pow((0.45 - t) / 0.47, 2));
    return (w / 2 - 6) * Math.pow(Math.cos(((t - 0.45) / 0.55) * (Math.PI / 2)), 0.8) + 4;
  };
  for (let y = 0; y < h; y++) {
    const hw = half(y);
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x + 0.5 - cx) / Math.max(1, hw);
      if (d > 1) continue;
      g.set(x, y, d > 0.9 ? '#7d8a9c' : d > 0.55 ? '#a2adbd' : '#b3bdcb');
    }
  }
  // Curved hull bands.
  for (const k of [0.3, 0.6, 0.85]) {
    for (let y = 4; y < h - 4; y++) {
      const hw = half(y) * k;
      g.set(cx - hw, y, '#8693a6');
      g.set(cx + hw, y, '#8693a6');
    }
  }
  // Bulging pods along the flanks.
  for (let i = 0; i < 9; i++) {
    const y = 26 + i * 20;
    const hw = half(y);
    for (const side of [-1, 1]) {
      const x = cx + side * (hw - 10);
      g.circle(x, y, 8, '#97a3b4');
      g.circle(x - side, y - 1, 6, '#c2cad6');
      g.set(x, y + 3, '#5e6a7c');
    }
  }
  // Raised spine and bridge blister.
  g.poly([[cx - 10, 14], [cx + 10, 14], [cx + 5, h - 26], [cx - 5, h - 26]], '#c5cdd8');
  for (let y = 24; y < h - 30; y += 10) g.rect(cx - 5, y, 10, 1, '#8693a6');
  g.circle(cx, h - 46, 9, '#d3dae3');
  g.circle(cx, h - 46, 5, '#5ab4ff');
  // Rebel red markings.
  for (const y of [60, 120]) {
    g.rect(cx - 40, y, 22, 3, '#b8322e');
    g.rect(cx + 18, y, 22, 3, '#b8322e');
  }
  // Panel lights.
  for (let i = 0; i < 50; i++) {
    const y = rng.next() * h;
    const x = cx + (rng.next() * 2 - 1) * half(y) * 0.85;
    g.set(x, y, rng.chance(0.6) ? '#ffe9a8' : '#9fdcff');
  }
  darken(g, 0.52, new Set(['#ffe9a8', '#9fdcff', '#5ab4ff']));
  // Engine glow along the stern.
  for (const ex of [-90, -54, -18, 18, 54, 90]) {
    g.rect(cx + ex - 9, 0, 18, 3, '#9fe8ff');
    g.rect(cx + ex - 6, 0, 12, 1, '#ffffff');
  }
  g.outline(OUTLINE);
  return g;
}

/** Rebel shield generator on Hoth: a big dome on a ringed base with a mast. */
function buildGeneratorGrid(): PixelGrid {
  const g = new PixelGrid(84, 64);
  const cx = 42;
  g.rect(4, 44, 76, 16, '#5b6574');
  g.rect(4, 44, 76, 3, '#8d97a6');
  for (let x = 8; x < 78; x += 10) g.rect(x, 50, 6, 6, '#3d4552');
  for (let y = 10; y < 48; y++) {
    for (let x = 0; x < 84; x++) {
      const dx = (x + 0.5 - cx) / 34;
      const dy = (y + 0.5 - 46) / 36;
      if (dx * dx + dy * dy > 1) continue;
      const light = -dx * 0.6 - dy * 0.4;
      g.set(x, y, light > 0.4 ? '#eef3f8' : light > 0 ? '#ccd5df' : light > -0.4 ? '#a9b4c1' : '#86919f');
    }
  }
  // Panel seams on the dome.
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) {
    for (let t = 0; t < 1; t += 0.02) g.set(cx + Math.sin(a) * 34 * t, 46 - Math.cos(a) * 36 * t, '#7d8897');
  }
  // Mast and beacon.
  g.rect(cx - 1, 0, 3, 12, '#5b6574');
  g.rect(cx - 4, 4, 9, 2, '#8d97a6');
  g.circle(cx + 0.5, 1.5, 1.6, '#ff4a4a');
  // Glowing power conduits.
  g.rect(14, 41, 56, 2, '#5ab4ff');
  g.outline(OUTLINE);
  return g;
}

/** Rebel defence turret: pale armoured dome with red bands and twin barrels. */
function buildRebelTurretGrid(): PixelGrid {
  const g = new PixelGrid(24, 26);
  g.circle(12, 11, 11, '#6b6456');
  g.circle(12, 10.5, 10, '#b9b29f');
  g.circle(12, 9.5, 7.5, '#e2dccb');
  g.circle(11, 8.5, 4, '#f5f1e6');
  g.rect(3, 10, 18, 2, '#b8322e');
  g.rect(8, 14, 2, 11, '#3d3a33');
  g.rect(14, 14, 2, 11, '#3d3a33');
  g.rect(8, 23, 2, 2, '#ff5a4a');
  g.rect(14, 23, 2, 2, '#ff5a4a');
  g.outline(OUTLINE);
  return g;
}

/** Small thermal exhaust port in the trench floor: the final target. */
function buildPortGrid(): PixelGrid {
  const g = new PixelGrid(26, 26);
  g.rect(1, 1, 24, 24, '#3a3e47');
  g.rect(1, 1, 24, 2, '#5d626c');
  g.rect(3, 3, 20, 20, '#25282e');
  g.circle(13, 13, 8, '#ffb347');
  g.circle(13, 13, 6.5, '#ff7a2a');
  g.circle(13, 13, 4.5, '#121317');
  for (const [x, y] of [[4, 4], [21, 4], [4, 21], [21, 21]] as const) g.set(x, y, '#ffe9a8');
  g.outline(OUTLINE);
  return g;
}

/** Shield generator dome on the flagship's hull: the empire's final target. */
function buildReactorGrid(): PixelGrid {
  const g = new PixelGrid(28, 24);
  g.rect(2, 16, 24, 6, '#6c7686');
  g.rect(2, 16, 24, 2, '#a2adbd');
  g.circle(14, 15, 10, '#c5cdd8');
  g.circle(13, 13, 7, '#e3e8ee');
  g.rect(4, 13, 20, 3, '#5ab4ff');
  for (let y = 16; y < 24; y++) for (let x = 0; x < 28; x++) if (g.get(x, y) === '#c5cdd8') g.set(x, y, '#6c7686');
  g.circle(10, 9, 1.5, '#ffffff');
  g.outline(OUTLINE);
  return g;
}

/** Map icon: a grey battle-station sphere with a dish and an equator trench. */
function buildDeathStarIcon(): PixelGrid {
  const g = new PixelGrid(52, 52);
  const c = 26;
  for (let y = 0; y < 52; y++) {
    for (let x = 0; x < 52; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      if (Math.hypot(dx, dy) > 24) continue;
      const light = (-dx * 0.6 - dy * 0.5) / 24 + 0.3;
      const dither = ((x & 1) ^ (y & 1)) * 0.1;
      g.set(x, y, light + dither < -0.3 ? '#3c414b' : light + dither < 0.1 ? '#6a707c' : '#9aa1ad');
    }
  }
  g.rect(2, 25, 48, 2, '#2c3038');
  g.circle(17, 16, 6.5, '#6a707c');
  g.circle(17, 16, 5, '#535965');
  g.circle(16.5, 15.5, 1.5, '#9aa1ad');
  for (let i = 0; i < 18; i++) g.set(6 + ((i * 7) % 40), 10 + ((i * 11) % 32), '#c7ccd4');
  g.outline(OUTLINE);
  return g;
}

/** Map icon: the flagship from above, small. */
function buildFlagshipIcon(): PixelGrid {
  const g = new PixelGrid(48, 44);
  g.circle(24, 16, 14, '#b3bdcb');
  g.poly([[10, 16], [38, 16], [27, 42], [21, 42]], '#b3bdcb');
  g.poly([[22, 4], [26, 4], [25, 38], [23, 38]], '#d3dae3');
  for (const y of [10, 18, 26]) {
    g.circle(12 + (y - 10) / 3, y, 2.5, '#97a3b4');
    g.circle(36 - (y - 10) / 3, y, 2.5, '#97a3b4');
  }
  g.rect(16, 2, 16, 2, '#9fe8ff');
  g.rect(18, 14, 4, 1, '#b8322e');
  g.rect(26, 14, 4, 1, '#b8322e');
  g.outline(OUTLINE);
  return g;
}

/** Map icon for the Hoth generator. */
function buildGeneratorIcon(): PixelGrid {
  const g = buildGeneratorGrid();
  const icon = new PixelGrid(56, 44);
  // Downscale by sampling every 1.5 pixels.
  for (let y = 0; y < 44; y++) for (let x = 0; x < 56; x++) icon.set(x, y, g.get(Math.floor(x * 1.5), Math.floor(y * 1.5)));
  return icon;
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
  add(BOSS_TEX.flagship, buildFlagshipGrid().toCanvas());
  add(BOSS_TEX.generator, buildGeneratorGrid().toCanvas());
  add(BOSS_TEX.rebelTurret, buildRebelTurretGrid().toCanvas());
  add(BOSS_TEX.port, buildPortGrid().toCanvas());
  add(BOSS_TEX.reactor, buildReactorGrid().toCanvas());
  add(BOSS_TEX.icon('death-star'), buildDeathStarIcon().toCanvas());
  add(BOSS_TEX.icon('rebel-flagship'), buildFlagshipIcon().toCanvas());
  add(BOSS_TEX.icon('hoth-generator'), buildGeneratorIcon().toCanvas());

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
