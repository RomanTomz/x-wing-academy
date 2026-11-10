import Phaser from 'phaser';
import { unlocksOfKind, type ShipId } from '../progression/unlocks';
import { createRng } from '../education/rng';
import { hex, PixelGrid, shade, type Point } from './pixelGrid';
import { TIE_BUILDERS } from './ties';

/** Display scale for pixel sprites. */
export const PIXEL_SCALE = 3;

const OUTLINE = '#10141c';
const PAINT = '#d8322e';
const PAINT_DARK = '#8f1d1d';

export const TEX = {
  enemy: 'enemy',
  droid: 'droid',
  crystal: 'crystal',
  asteroid: (i: number) => `asteroid-${i}`,
  ship: (paintId: string, shipId: string = 'x-wing') => `ship-${shipId}-${paintId}`,
  helmetImperial: 'helmet-imperial',
  laser: (laserId: string) => `bolt-${laserId}`,
  spark: 'spark',
  pixel: 'pixel',
  ring: 'ring',
  flare: 'flare',
  shield: 'shield',
  starsFar: 'stars-far',
  starsMid: 'stars-mid',
  starsNear: 'stars-near',
  nebula: 'nebula',
  planet: 'planet',
  moon: 'moon',
  cruiser: 'cruiser',
  helmet: 'helmet',
  lock: 'lock',
  speaker: 'speaker',
  pause: 'pause-icon',
  medal: 'medal',
} as const;

export const ASTEROID_VARIANTS = 3;

/** Texture for the player's chosen starfighter in its chosen paint. */
export function shipTexture(e: { ship: string; paint: string }): string {
  return TEX.ship(e.paint, e.ship);
}

function addGrid(scene: Phaser.Scene, key: string, grid: PixelGrid): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, grid.toCanvas(1));
}

function addCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

/** Original four-winged starfighter, top-down, nose up. */
export function buildShipGrid(): PixelGrid {
  const HULL = '#eef1f6';
  const HULL2 = '#b6bfcc';
  const DARK = '#6b7686';
  const DEEP = '#3d4554';
  const GUN = '#9098a8';
  const TIP = '#ff6b5a';
  const g = new PixelGrid(37, 40);

  // Lower wings (seen behind the upper ones — together they make the X).
  g.poly([[16, 23], [1, 26], [1, 31], [16, 31]], DARK);
  g.poly([[15, 25.5], [2, 27.6], [2, 28.6], [15, 27.2]], PAINT_DARK);
  g.rect(0, 10, 2, 22, GUN);
  g.rect(0, 9, 2, 2, TIP);
  g.rect(0, 30, 2, 3, DEEP);

  // Upper wings.
  g.poly([[16, 20], [4.5, 22.5], [4.5, 28.5], [16, 29]], HULL2);
  g.poly([[15.5, 22.2], [5, 24], [5, 25.6], [15.5, 24.4]], PAINT);
  g.rect(4, 6, 2, 24, GUN);
  g.rect(4, 5, 2, 2, TIP);
  g.rect(4, 29, 2, 3, DEEP);

  // Engines.
  g.rect(12.5, 18, 4, 15, DARK);
  g.rect(13.5, 19, 2, 12, HULL2);
  g.rect(13, 32, 3, 2, '#ffcf5a');

  // Fuselage.
  g.poly([[18.5, 0], [16.8, 3], [15.8, 13], [15.5, 31], [16.5, 37], [20.5, 37], [21.5, 31], [21.2, 13], [20.2, 3]], HULL);
  g.poly([[17.2, 4], [16.3, 13], [16.1, 31], [16.9, 31], [17.1, 13], [17.8, 4]], HULL2);
  g.poly([[16.6, 7], [20.4, 7], [20.5, 9], [16.5, 9]], PAINT);
  g.rect(16, 33, 5, 2, DEEP);

  // Canopy.
  g.poly([[17.2, 11.5], [19.8, 11.5], [20.4, 18], [16.6, 18]], '#46c3ff');
  g.rect(16.6, 15.8, 4, 1, '#1d5f8c');
  g.rect(17, 12, 1, 3, '#bff0ff');

  // Droid socket behind the cockpit.
  g.circle(18.5, 22, 1.7, '#4b8bff');
  g.set(18, 21, '#d7e3ff');

  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

/** Original twin-engine bomber, top-down: forward cockpit pod and two long engine nacelles. */
export function buildYWingGrid(): PixelGrid {
  const HULL = '#eef1f6';
  const HULL2 = '#b6bfcc';
  const DARK = '#6b7686';
  const DEEP = '#3d4554';
  const g = new PixelGrid(33, 44);
  // Engine nacelles.
  g.rect(3, 14, 6, 28, DARK);
  g.rect(4, 15, 2, 26, HULL2);
  g.rect(3, 13, 6, 2, DEEP);
  g.rect(3, 30, 6, 2, PAINT);
  g.rect(4, 41, 4, 2, '#ffcf5a');
  // Cross wing joining the nacelles.
  g.rect(8, 20, 9, 4, HULL2);
  g.rect(8, 22, 9, 1, PAINT_DARK);
  // Central body and nose.
  g.poly([[16.5, 0], [19, 4], [19.6, 12], [18.6, 31], [14.4, 31], [13.4, 12], [14, 4]], HULL);
  g.poly([[14.6, 5], [14, 12], [13.9, 30], [14.8, 30], [15, 12], [15.4, 5]], HULL2);
  g.poly([[15, 3], [18, 3], [18.6, 9], [14.4, 9]], '#46c3ff');
  g.rect(15.2, 4, 1, 3, '#bff0ff');
  g.rect(13.8, 11, 5.4, 2, PAINT);
  g.rect(13.8, 16, 5.4, 1, PAINT_DARK);
  g.rect(13, 31, 7, 5, DEEP);
  g.circle(16.5, 26, 1.8, '#4b8bff');
  g.set(16, 25, '#d7e3ff');
  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

/** Original cross-shaped heavy fighter: tall main wing, cockpit pod on top, side foils with cannons. */
export function buildBWingGrid(): PixelGrid {
  const HULL = '#eef1f6';
  const HULL2 = '#b6bfcc';
  const DARK = '#6b7686';
  const DEEP = '#3d4554';
  const g = new PixelGrid(41, 46);
  // Side foils with cannons at the tips.
  g.poly([[18, 22], [3, 24], [3, 27], [18, 28]], HULL2);
  g.poly([[17, 24], [5, 25.2], [5, 26.2], [17, 25.8]], PAINT);
  g.rect(2, 13, 2, 16, '#9098a8');
  g.rect(2, 12, 2, 2, '#ff6b5a');
  // Main wing (tall blade).
  g.poly([[18.5, 8], [22.5, 8], [23.5, 44], [17.5, 44]], HULL2);
  g.poly([[19.5, 10], [21.5, 10], [21.8, 42], [19.2, 42]], HULL);
  g.rect(18, 36, 5, 2, PAINT);
  g.rect(18, 40, 5, 1, PAINT_DARK);
  // Engine hub.
  g.rect(14.5, 22, 12, 9, DARK);
  g.rect(15.5, 23, 10, 2, HULL2);
  for (const x of [15.5, 18.5]) g.rect(x, 30, 2, 2, '#ffcf5a');
  g.rect(15, 27, 11, 1, DEEP);
  // Cockpit pod.
  g.circle(20.5, 6, 5, HULL);
  g.circle(20.5, 6.5, 4.6, HULL2);
  g.circle(20.5, 5.5, 3, '#46c3ff');
  g.set(19, 4, '#bff0ff');
  g.rect(20, 0, 1, 2, '#9098a8');
  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

/** Original twin-panel enemy fighter, front view. (The player's TIEs are in ties.ts.) */
export function buildEnemyGrid(): PixelGrid {
  const RIM = '#a6b1cc';
  const PANEL = '#262c3d';
  const RIB = '#4c5670';
  const ACCENT = '#c35cff';
  const g = new PixelGrid(45, 36);

  // Wing panel (left), elongated hexagon.
  g.poly([[6, 0], [11.5, 6], [11.5, 30], [6, 36], [0.5, 30], [0.5, 6]], RIM);
  g.poly([[6, 1.8], [10.3, 6.6], [10.3, 29.4], [6, 34.2], [1.7, 29.4], [1.7, 6.6]], PANEL);
  for (const [x, y] of [[6, 2], [10, 6.5], [10, 29.5], [6, 34], [2, 29.5], [2, 6.5]] as Point[]) g.line(6, 18, x, y, RIB);
  g.line(6, 4, 6, 32, RIB);
  g.circle(6, 18, 1.6, RIM);
  g.set(6, 1, ACCENT);
  g.set(6, 34, ACCENT);

  // Strut.
  g.rect(11.5, 16, 6, 4, '#7d869a');
  g.rect(11.5, 19, 6, 1, '#4d5466');
  g.rect(15.5, 14.5, 2, 7, '#5b6476');

  // Cockpit ball.
  g.circle(22.5, 18.5, 7.6, '#666e83');
  g.circle(22.5, 17.6, 6.9, '#a3abbe');
  g.circle(22.5, 18, 4.4, '#131725');
  for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0], [3, -3], [3, 3], [-3, 3], [-3, -3]] as Point[]) {
    g.line(22.5, 18, 22.5 + dx, 18 + dy, '#37405a');
  }
  g.circle(22.5, 18, 1.8, '#ff3b5c');
  g.set(22, 17, '#ffc2cc');

  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

function buildDroidGrid(): PixelGrid {
  const g = new PixelGrid(13, 13);
  g.circle(6.5, 6.5, 5.8, '#dfe6ef');
  g.circle(6.5, 7.2, 5, '#c3ccd8');
  g.circle(6.5, 6.2, 4.6, '#e9eef5');
  for (const [x, y] of [[3, 3], [8, 3], [3, 8], [8, 8]] as Point[]) g.rect(x, y, 2, 2, '#3b82f6');
  g.rect(5, 2, 3, 1, '#3b82f6');
  g.circle(6.5, 5.5, 1.4, '#1a1f2b');
  g.set(6, 5, '#ff4d4d');
  g.outline(OUTLINE);
  return g;
}

function buildCrystalGrid(): PixelGrid {
  const g = new PixelGrid(13, 19);
  g.poly([[6.5, 0], [13, 7], [6.5, 19], [0, 7]], '#4fd9f2');
  g.poly([[6.5, 0], [6.5, 19], [0, 7]], '#9af3ff');
  g.poly([[6.5, 0], [10, 3.7], [6.5, 7], [3, 3.7]], '#e9feff');
  g.poly([[6.5, 7], [13, 7], [6.5, 19]], '#22a3c9');
  g.outline('#0b3a55');
  return g;
}

function buildAsteroidGrid(seed: number): PixelGrid {
  const rng = createRng(seed);
  const size = 30;
  const g = new PixelGrid(size, size);
  const pts: Point[] = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 10.5 + rng.next() * 3.5;
    pts.push([15 + Math.cos(a) * r, 15 + Math.sin(a) * r]);
  }
  g.poly(pts, '#7c6b5d');
  // Craters.
  for (let i = 0; i < 4; i++) {
    const cx = 9 + rng.next() * 12;
    const cy = 9 + rng.next() * 12;
    const r = 1.5 + rng.next() * 2;
    g.circle(cx, cy, r, '#5d4f45');
    g.circle(cx - 0.6, cy - 0.6, r * 0.55, '#4a3f37');
  }
  // Light from the top-left.
  const lit = g.clone();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!lit.get(x, y)) continue;
      if (!lit.get(x - 2, y - 2)) g.set(x, y, '#a8927f');
      else if (!lit.get(x + 2, y + 2)) g.set(x, y, '#463a33');
    }
  }
  g.outline('#1c1612');
  return g;
}

function buildPlanetGrid(): PixelGrid {
  const size = 96;
  const g = new PixelGrid(size, size);
  const c = size / 2;
  const bands = ['#3b5bdb', '#4c6ef5', '#5c7cfa', '#7048e8', '#5f3dc4', '#4c6ef5', '#748ffc'];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > c - 1) continue;
      const band = bands[Math.floor(((y + Math.sin(x / 9) * 3) / size) * bands.length) % bands.length];
      // Terminator shading with ordered dithering for a 16-bit feel.
      const light = (-dx * 0.6 - dy * 0.5) / c + 0.35;
      const dither = ((x & 1) ^ (y & 1)) * 0.12;
      if (light + dither < -0.25) g.set(x, y, '#120f2e');
      else if (light + dither < 0.05) g.set(x, y, '#241e5a');
      else g.set(x, y, band);
      if (light > 0.75 && (x + y) % 3 === 0) g.set(x, y, '#a5b4fc');
    }
  }
  return g;
}

function buildMoonGrid(): PixelGrid {
  const size = 40;
  const g = new PixelGrid(size, size);
  g.circle(20, 20, 19, '#8d93a5');
  g.circle(23, 23, 17, '#6c7287');
  g.circle(18, 17, 15, '#a6acbd');
  g.circle(14, 14, 3, '#8d93a5');
  g.circle(25, 26, 4, '#5a6075');
  g.circle(26, 12, 2, '#8d93a5');
  return g;
}

/** Friendly capital ship for briefings, side view, flying right. */
function buildCruiserGrid(): PixelGrid {
  const g = new PixelGrid(120, 34);
  const HULL = '#d9dee8';
  const HULL2 = '#a9b1c2';
  const DARK = '#5d6678';
  g.poly([[8, 14], [70, 10], [112, 15], [118, 18], [112, 21], [70, 25], [8, 24]], HULL);
  g.poly([[8, 20], [70, 21], [112, 21], [70, 25], [8, 24]], HULL2);
  g.rect(16, 6, 22, 9, HULL);
  g.rect(18, 3, 10, 4, HULL2);
  g.rect(40, 8, 14, 4, HULL2);
  g.rect(0, 12, 9, 14, DARK);
  for (let i = 0; i < 3; i++) g.rect(0, 13 + i * 4, 3, 3, '#7fd4ff');
  for (let x = 24; x < 104; x += 6) g.rect(x, 17, 3, 1, '#ffe08a');
  g.rect(60, 12, 30, 1, '#d8322e');
  g.outline(OUTLINE);
  return g;
}

function buildImperialHelmetGrid(): PixelGrid {
  const g = new PixelGrid(22, 22);
  g.circle(11, 11, 9.5, '#1c1f27');
  g.circle(11, 10, 8.5, '#2c313c');
  g.rect(5, 9, 12, 7, '#151820');
  g.circle(7.5, 11.5, 2.2, '#3a4152');
  g.circle(14.5, 11.5, 2.2, '#3a4152');
  g.set(7, 11, '#7fe8ff');
  g.set(14, 11, '#7fe8ff');
  g.rect(9, 15, 4, 4, '#5a6170');
  g.rect(6, 17, 2, 3, '#7d8494');
  g.rect(14, 17, 2, 3, '#7d8494');
  g.rect(9, 3, 4, 2, '#5a6170');
  g.outline(OUTLINE);
  return g;
}

function buildHelmetGrid(): PixelGrid {
  const g = new PixelGrid(22, 22);
  g.circle(11, 11, 9.5, '#f28c28');
  g.circle(11, 10, 8.5, '#ffa94d');
  g.rect(4, 11, 14, 5, '#1e2a3a');
  g.rect(5, 12, 5, 2, '#5fd3ff');
  g.rect(9, 3, 4, 7, '#ffffff');
  g.rect(10, 4, 2, 5, '#d8322e');
  g.rect(3, 16, 16, 3, '#ced6e0');
  g.outline(OUTLINE);
  return g;
}

function buildLockGrid(): PixelGrid {
  const g = new PixelGrid(11, 13);
  g.rect(2, 1, 7, 6, '#9aa6bd');
  g.rect(1, 6, 9, 7, '#ffd23f');
  g.rect(5, 8, 1, 3, '#7a5a00');
  // Hollow out the shackle.
  for (let y = 3; y < 6; y++) for (let x = 4; x < 7; x++) g.set(x, y, null);
  g.outline(OUTLINE);
  return g;
}

function buildMedalGrid(): PixelGrid {
  const g = new PixelGrid(24, 30);
  g.poly([[6, 0], [11, 0], [13, 12], [8, 12]], '#d8322e');
  g.poly([[13, 0], [18, 0], [16, 12], [11, 12]], '#2f7bff');
  g.circle(12, 19, 9.5, '#b8860b');
  g.circle(12, 18.5, 8.5, '#ffd23f');
  g.poly([[12, 12], [14, 17], [19, 17], [15, 20.5], [16.5, 25.5], [12, 22.5], [7.5, 25.5], [9, 20.5], [5, 17], [10, 17]], '#fff2b0');
  g.outline(OUTLINE);
  return g;
}

function starCanvas(ctx: CanvasRenderingContext2D, size: number, count: number, maxR: number, seed: number, colors: string[]): void {
  const rng = createRng(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng.next() * size);
    const y = Math.floor(rng.next() * size);
    const r = rng.next() * maxR;
    ctx.fillStyle = rng.pick(colors);
    ctx.globalAlpha = 0.4 + rng.next() * 0.6;
    if (r < 1) ctx.fillRect(x, y, 1, 1);
    else if (r < 2) ctx.fillRect(x, y, 2, 2);
    else {
      // Twinkly cross star.
      ctx.fillRect(x - 1, y, 4, 2);
      ctx.fillRect(x, y - 1, 2, 4);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 3, y, 8, 2);
      ctx.fillRect(x, y - 3, 2, 8);
    }
  }
  ctx.globalAlpha = 1;
}

export function generateTextures(scene: Phaser.Scene): void {
  // Ships in every paint job.
  const ships: Record<ShipId, PixelGrid> = {
    'x-wing': buildShipGrid(),
    'y-wing': buildYWingGrid(),
    'b-wing': buildBWingGrid(),
    'tie-fighter': TIE_BUILDERS['tie-fighter'](),
    'tie-interceptor': TIE_BUILDERS['tie-interceptor'](),
    'tie-bomber': TIE_BUILDERS['tie-bomber'](),
    'tie-advanced': TIE_BUILDERS['tie-advanced'](),
  };
  for (const [shipId, base] of Object.entries(ships)) {
    for (const paint of unlocksOfKind('paint')) {
      const accent = paint.accent ?? shade(paint.color, 0.6);
      addGrid(scene, TEX.ship(paint.id, shipId), base.clone().replace(PAINT, hex(paint.color)).replace(PAINT_DARK, hex(accent)));
    }
  }
  addGrid(scene, TEX.helmetImperial, buildImperialHelmetGrid());
  addGrid(scene, TEX.enemy, buildEnemyGrid());
  addGrid(scene, TEX.droid, buildDroidGrid());
  addGrid(scene, TEX.crystal, buildCrystalGrid());
  for (let i = 0; i < ASTEROID_VARIANTS; i++) addGrid(scene, TEX.asteroid(i), buildAsteroidGrid(101 + i * 17));
  addGrid(scene, TEX.planet, buildPlanetGrid());
  addGrid(scene, TEX.moon, buildMoonGrid());
  addGrid(scene, TEX.cruiser, buildCruiserGrid());
  addGrid(scene, TEX.helmet, buildHelmetGrid());
  addGrid(scene, TEX.lock, buildLockGrid());
  addGrid(scene, TEX.medal, buildMedalGrid());

  // Laser bolts: white-hot core with a coloured glow.
  for (const laser of unlocksOfKind('laser')) {
    addCanvas(scene, TEX.laser(laser.id), 14, 44, (ctx) => {
      const col = hex(laser.color);
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(1, 2, 12, 40);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(3, 1, 8, 42);
      ctx.globalAlpha = 1;
      ctx.fillRect(4, 0, 6, 44);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 2, 2, 40);
    });
  }

  addCanvas(scene, TEX.spark, 16, 16, (ctx) => {
    const grd = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 16, 16);
  });
  addCanvas(scene, TEX.pixel, 4, 4, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
  });
  addCanvas(scene, TEX.flare, 128, 128, (ctx) => {
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
  });
  addCanvas(scene, TEX.ring, 128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.stroke();
  });
  addCanvas(scene, TEX.shield, 200, 160, (ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(100, 80, 96, 76, 0, 0, Math.PI * 2);
    ctx.clip();
    const grd = ctx.createRadialGradient(100, 80, 20, 100, 80, 96);
    grd.addColorStop(0, 'rgba(80,220,255,0.05)');
    grd.addColorStop(0.75, 'rgba(80,220,255,0.25)');
    grd.addColorStop(1, 'rgba(160,240,255,0.9)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 200, 160);
    // Hex pattern.
    ctx.strokeStyle = 'rgba(190,250,255,0.45)';
    ctx.lineWidth = 1.5;
    const s = 14;
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 10; col++) {
        const cx = col * s * 1.5;
        const cy = row * s * 0.866 * 2 + (col % 2) * s * 0.866;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          const px = cx + Math.cos(a) * s * 0.9;
          const py = cy + Math.sin(a) * s * 0.9;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,250,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(100, 80, 95, 75, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  addCanvas(scene, TEX.starsFar, 512, 512, (ctx) => starCanvas(ctx, 512, 260, 1.4, 1, ['#8aa2c8', '#ffffff', '#a8b8ff']));
  addCanvas(scene, TEX.starsMid, 512, 512, (ctx) => starCanvas(ctx, 512, 90, 1.9, 2, ['#ffffff', '#ffe9b0', '#b0d8ff']));
  addCanvas(scene, TEX.starsNear, 512, 512, (ctx) => starCanvas(ctx, 512, 22, 2.6, 3, ['#ffffff', '#bfe9ff']));
  addCanvas(scene, TEX.nebula, 640, 640, (ctx) => {
    const rng = createRng(77);
    const colors = ['120,60,200', '40,90,220', '200,50,140', '30,160,200'];
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const x = rng.next() * 640;
      const y = rng.next() * 640;
      const r = 80 + rng.next() * 180;
      const col = rng.pick(colors);
      for (const ox of [-640, 0, 640]) {
        for (const oy of [-640, 0, 640]) {
          const grd = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          grd.addColorStop(0, `rgba(${col},0.22)`);
          grd.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = grd;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
      }
    }
  });

  addCanvas(scene, TEX.speaker, 48, 48, (ctx) => {
    ctx.fillStyle = '#eaf8ff';
    ctx.beginPath();
    ctx.moveTo(8, 18);
    ctx.lineTo(16, 18);
    ctx.lineTo(26, 9);
    ctx.lineTo(26, 39);
    ctx.lineTo(16, 30);
    ctx.lineTo(8, 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const r of [8, 15]) {
      ctx.beginPath();
      ctx.arc(26, 24, r, -0.9, 0.9);
      ctx.stroke();
    }
  });
  addCanvas(scene, TEX.pause, 48, 48, (ctx) => {
    ctx.fillStyle = '#eaf8ff';
    ctx.fillRect(13, 10, 8, 28);
    ctx.fillRect(27, 10, 8, 28);
  });
}
