import { PixelGrid, type Point } from './pixelGrid';

/**
 * The player's TIE fighters, front view. Wing frames use the paint colour and
 * small details use the paint's accent, so every paint job works on them too.
 * Original pixel art.
 */
export const TIE_PAINT = '#d8322e';
export const TIE_PAINT_DARK = '#8f1d1d';

const OUTLINE = '#10141c';
const PANEL = '#262c3d';
const RIB = '#4c5670';
const STRUT = '#7d869a';
const STRUT_DARK = '#4d5466';

function cockpit(g: PixelGrid, cx: number, cy: number, r = 7.6): void {
  g.circle(cx, cy + 0.5, r, '#666e83');
  g.circle(cx, cy - 0.4, r - 0.7, '#a3abbe');
  g.circle(cx, cy, r - 3.2, '#131725');
  for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0], [3, -3], [3, 3], [-3, 3], [-3, -3]] as Point[]) {
    g.line(cx, cy, cx + dx * ((r - 3.2) / 4.4), cy + dy * ((r - 3.2) / 4.4), '#37405a');
  }
  g.circle(cx, cy, 1.8, '#7fe8ff');
  g.set(cx - 0.5, cy - 1, '#e0fbff');
}

/** Spokes from a wing's hub to each corner, over a dark solar panel. */
function wingPanel(g: PixelGrid, outer: readonly Point[], inner: readonly Point[], hub: Point): void {
  g.poly(outer, TIE_PAINT);
  g.poly(inner, PANEL);
  for (const [x, y] of inner) g.line(hub[0], hub[1], x, y, RIB);
  g.circle(hub[0], hub[1], 1.6, TIE_PAINT);
}

/** Classic twin hexagon panels. */
function tieFighter(): PixelGrid {
  const g = new PixelGrid(45, 36);
  wingPanel(
    g,
    [[6, 0], [11.5, 6], [11.5, 30], [6, 36], [0.5, 30], [0.5, 6]],
    [[6, 1.8], [10.3, 6.6], [10.3, 29.4], [6, 34.2], [1.7, 29.4], [1.7, 6.6]],
    [6, 18],
  );
  g.line(6, 4, 6, 32, RIB);
  g.set(6, 1, TIE_PAINT_DARK);
  g.set(6, 34, TIE_PAINT_DARK);
  g.rect(11.5, 16, 6, 4, STRUT);
  g.rect(11.5, 19, 6, 1, STRUT_DARK);
  g.rect(15.5, 14.5, 2, 7, '#5b6476');
  cockpit(g, 22.5, 18);
  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

/** Dagger wings: pointed tips bent inwards, with cannons at the tips. */
function tieInterceptor(): PixelGrid {
  const g = new PixelGrid(47, 40);
  wingPanel(
    g,
    [[0.5, 0], [12, 9], [12, 31], [0.5, 40], [5, 20]],
    [[2.5, 3], [10.8, 9.8], [10.8, 30.2], [2.5, 37], [6.4, 20]],
    [9, 20],
  );
  // Wingtip cannons.
  g.rect(0, 0, 2, 4, '#9098a8');
  g.rect(0, 36, 2, 4, '#9098a8');
  g.set(0, 0, TIE_PAINT_DARK);
  g.rect(12, 18, 6, 4, STRUT);
  g.rect(12, 21, 6, 1, STRUT_DARK);
  cockpit(g, 23.5, 20);
  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

/** Double hull: cockpit pod on the left, bomb pod on the right, bent wings outside. */
function tieBomber(): PixelGrid {
  const g = new PixelGrid(56, 40);
  const left: Point[] = [[0.5, 2], [9, 8], [10, 20], [9, 32], [0.5, 38], [3.5, 20]];
  const leftIn: Point[] = [[2.2, 4.5], [7.8, 9], [8.7, 20], [7.8, 31], [2.2, 35.5], [4.8, 20]];
  wingPanel(g, left, leftIn, [7, 20]);
  const flip = (pts: Point[]): Point[] => pts.map(([x, y]) => [56 - x, y] as Point);
  wingPanel(g, flip(left), flip(leftIn), [49, 20]);
  // Struts and the bridge between the pods.
  g.rect(10, 18, 5, 4, STRUT);
  g.rect(41, 18, 5, 4, STRUT);
  g.rect(20, 17, 16, 6, STRUT_DARK);
  g.rect(20, 17, 16, 2, STRUT);
  // Cockpit pod.
  cockpit(g, 19.5, 20, 6.8);
  // Bomb pod: long and armoured.
  g.circle(36.5, 20.5, 6.6, '#666e83');
  g.circle(36.5, 19.6, 5.9, '#a3abbe');
  g.circle(36.5, 20, 3.4, '#4d5466');
  g.rect(34.5, 14, 4, 2, TIE_PAINT_DARK);
  g.circle(36.5, 20, 1.4, '#ffb347');
  g.outline(OUTLINE);
  return g;
}

/** Swept, bent wings and a squared-off cockpit body. */
function tieAdvanced(): PixelGrid {
  const g = new PixelGrid(47, 38);
  wingPanel(
    g,
    [[0.5, 3], [10, 9], [12, 19], [10, 29], [0.5, 35], [4, 19]],
    [[2.4, 5.5], [8.9, 10], [10.6, 19], [8.9, 28], [2.4, 32.5], [5.4, 19]],
    [8, 19],
  );
  g.set(1, 3, TIE_PAINT_DARK);
  g.set(1, 34, TIE_PAINT_DARK);
  g.rect(12, 17, 4, 4, STRUT);
  // Squarer body behind the ball.
  g.rect(15, 11, 17, 16, '#4d5466');
  g.rect(15, 11, 17, 2, STRUT);
  g.rect(16, 25, 15, 1, '#3a4152');
  cockpit(g, 23.5, 19, 7);
  g.mirrorX();
  g.outline(OUTLINE);
  return g;
}

export const TIE_BUILDERS: Record<'tie-fighter' | 'tie-interceptor' | 'tie-bomber' | 'tie-advanced', () => PixelGrid> = {
  'tie-fighter': tieFighter,
  'tie-interceptor': tieInterceptor,
  'tie-bomber': tieBomber,
  'tie-advanced': tieAdvanced,
};
