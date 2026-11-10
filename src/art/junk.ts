import Phaser from 'phaser';
import { PixelGrid, pointInPolygon, type Point } from './pixelGrid';

/**
 * Space junk for debris fields: bits of broken ships and old cargo, so it reads
 * as wreckage rather than rocks. Original pixel art.
 */
export const JUNK_VARIANTS = 6;
export const junkTexture = (i: number): string => `junk-${i}`;

const OUTLINE = '#14161c';
const STEEL = '#8e97a6';
const STEEL_LIGHT = '#b9c1cd';
const STEEL_DARK = '#5a6271';
const DEEP = '#363b46';
const RUST = '#b5652e';
const RUST_DARK = '#7a3f1c';
const WARN = '#f2c230';
const GLOW = '#7fe8ff';

/** Bent hull panel with rivets, a hazard stripe and a torn edge. */
function panel(): PixelGrid {
  const g = new PixelGrid(30, 26);
  g.poly([[2, 4], [24, 1], [28, 9], [26, 22], [16, 25], [10, 20], [3, 23]], STEEL);
  g.poly([[2, 4], [24, 1], [25, 4], [3, 7]], STEEL_LIGHT);
  g.poly([[10, 20], [16, 25], [26, 22], [26, 19], [16, 22]], STEEL_DARK);
  for (let x = 5; x < 24; x += 4) g.set(x, 9, DEEP);
  for (let x = 6; x < 24; x += 4) g.set(x, 18, DEEP);
  for (let k = 0; k < 4; k++) g.poly([[6 + k * 5, 12], [9 + k * 5, 12], [7 + k * 5, 15], [4 + k * 5, 15]], k % 2 ? DEEP : WARN);
  g.rect(19, 5, 4, 3, RUST);
  g.set(20, 6, RUST_DARK);
  // Jagged tear.
  for (const [x, y] of [[10, 20], [12, 21], [11, 19], [14, 23]] as const) g.set(x, y, null);
  g.outline(OUTLINE);
  return g;
}

/** Snapped pipe section with flanges and a spilling cable. */
function pipe(): PixelGrid {
  const g = new PixelGrid(32, 16);
  g.rect(3, 4, 24, 8, STEEL);
  g.rect(3, 4, 24, 2, STEEL_LIGHT);
  g.rect(3, 10, 24, 2, STEEL_DARK);
  for (const x of [2, 13, 25]) {
    g.rect(x, 2, 3, 12, STEEL_DARK);
    g.rect(x, 2, 1, 12, STEEL_LIGHT);
  }
  g.rect(16, 6, 6, 3, RUST);
  // Broken end and dangling wires.
  for (const y of [5, 7, 9]) g.set(27, y, DEEP);
  g.line(27, 6, 31, 3, '#e04a3a');
  g.line(27, 9, 30, 13, '#3a8ae0');
  g.set(31, 3, GLOW);
  g.outline(OUTLINE);
  return g;
}

/** Half of a broken fighter wing: hexagonal frame with a crack and a missing corner. */
function wing(): PixelGrid {
  const g = new PixelGrid(22, 30);
  g.poly([[11, 0], [21, 7], [21, 23], [11, 30], [1, 23], [1, 7]], '#9aa4ba');
  g.poly([[11, 2], [19, 8], [19, 22], [11, 28], [3, 22], [3, 8]], '#2a3040');
  for (const [x, y] of [[11, 2], [19, 8], [19, 22], [11, 28], [3, 22], [3, 8]] as const) g.line(11, 15, x, y, '#4c5670');
  g.circle(11, 15, 2, '#9aa4ba');
  // Snapped off corner.
  const missing: Point[] = [[13, 30], [22, 30], [22, 18], [17, 21]];
  for (let y = 0; y < 30; y++) for (let x = 0; x < 22; x++) if (pointInPolygon(x + 0.5, y + 0.5, missing)) g.set(x, y, null);
  g.line(12, 15, 16, 21, '#cfd6e6');
  g.set(15, 20, '#ffb347');
  g.set(16, 22, '#ff7a3d');
  g.outline(OUTLINE);
  return g;
}

/** Old droid head, dented, with a flickering lens. */
function droidHead(): PixelGrid {
  const g = new PixelGrid(24, 22);
  // Dome only: clear the lower half, then add the neck ring.
  g.circle(12, 12, 10, '#d4dbe5');
  for (let y = 13; y < 22; y++) for (let x = 0; x < 24; x++) g.set(x, y, null);
  g.rect(2, 12, 20, 4, STEEL_DARK);
  g.rect(2, 12, 20, 1, STEEL);
  g.rect(5, 4, 4, 3, '#3b6fd8');
  g.rect(14, 6, 5, 2, '#3b6fd8');
  g.circle(11, 8, 2.2, '#1a1f2b');
  g.set(10, 7, '#ff4d4d');
  g.rect(16, 2, 3, 2, RUST);
  g.set(6, 10, DEEP);
  g.set(7, 11, DEEP);
  g.outline(OUTLINE);
  return g;
}

/** Cargo crate that has burst open. */
function crate(): PixelGrid {
  const g = new PixelGrid(26, 24);
  g.rect(2, 6, 20, 16, '#6d7a5a');
  g.rect(2, 6, 20, 2, '#8d9a78');
  g.rect(2, 20, 20, 2, '#4a5440');
  for (const x of [2, 11, 20]) g.rect(x, 6, 2, 16, '#4a5440');
  g.rect(6, 12, 12, 4, WARN);
  g.rect(8, 13, 2, 2, DEEP);
  g.rect(13, 13, 2, 2, DEEP);
  // Lid flipped open.
  g.poly([[4, 6], [20, 6], [25, 0], [9, 1]], '#7f8c6a');
  g.line(9, 1, 25, 0, '#9fac88');
  g.set(23, 10, GLOW);
  g.set(24, 14, '#ffd23f');
  g.outline(OUTLINE);
  return g;
}

/** Bent comms dish on a broken strut. */
function dish(): PixelGrid {
  const g = new PixelGrid(28, 28);
  g.circle(13, 12, 11, STEEL_LIGHT);
  g.circle(14, 13, 9, STEEL);
  g.circle(15, 14, 6, STEEL_DARK);
  g.circle(14, 13, 1.5, '#ff6b5a');
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    g.line(14, 13, 14 + Math.cos(ang) * 9, 13 + Math.sin(ang) * 9, STEEL_DARK);
  }
  g.rect(19, 21, 3, 7, DEEP);
  g.rect(19, 21, 1, 7, STEEL);
  g.rect(18, 26, 5, 2, RUST_DARK);
  // Dent.
  g.circle(6, 8, 2.4, STEEL_DARK);
  g.outline(OUTLINE);
  return g;
}

export function generateJunkTextures(scene: Phaser.Scene): void {
  const builders = [panel, pipe, wing, droidHead, crate, dish];
  builders.forEach((build, i) => {
    const key = junkTexture(i);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, build().toCanvas());
  });
}
