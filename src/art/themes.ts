import Phaser from 'phaser';
import type { Planet, ThemeId } from '../progression/campaign';
import { deathStarTerrain, duneTerrain, forestTerrain, frostTerrain, hullTerrain, moonTerrain, planetSprite, starGrid, stationSprite, tropicTerrain } from './terrain';

export const THEME_TEX = {
  terrain: (t: ThemeId) => `terrain-${t}`,
  planet: (t: ThemeId) => `planet-${t}`,
  star: 'star',
} as const;

/** Picture for a place on the map, picker and briefing: a planet, or the boss itself. */
export function placeIcon(p: Planet): string {
  return p.kind === 'boss' ? `boss-icon-${p.id}` : THEME_TEX.planet(p.theme as ThemeId);
}

export interface Theme {
  id: ThemeId | 'space';
  /** Dark wash over the terrain so ships, numbers and HUD stay readable. */
  overlay: { color: number; alpha: number };
  /** Ground scroll speed (screen px/s). */
  groundSpeed: number;
  weather: 'none' | 'snow' | 'sand' | 'fireflies' | 'dust' | 'rain';
  /** What the dodge-or-blast interlude throws at you: rocks, or broken bits of ships. */
  debris: 'rock' | 'junk';
  asteroidTint: number;
  crystalTint: number;
  crystalName: string;
  asteroidName: string;
  asteroidHint: string;
  music: { transpose: number; bpm: number };
}

export const THEMES: Record<ThemeId | 'space', Theme> = {
  space: {
    id: 'space',
    debris: 'junk',
    overlay: { color: 0x000000, alpha: 0 },
    groundSpeed: 0,
    weather: 'none',
    asteroidTint: 0xffffff,
    crystalTint: 0xffffff,
    crystalName: 'Collect the crystals!',
    asteroidName: 'Space junk!',
    asteroidHint: 'Space junk! Dodge it or blast it!',
    music: { transpose: 0, bpm: 112 },
  },
  moon: {
    id: 'moon',
    debris: 'rock',
    overlay: { color: 0x050814, alpha: 0.3 },
    groundSpeed: 70,
    weather: 'dust',
    asteroidTint: 0xd8d8e8,
    crystalTint: 0xffffff,
    crystalName: 'Grab the moon crystals!',
    asteroidName: 'Meteor shower!',
    asteroidHint: 'Meteors! Dodge them or blast them!',
    music: { transpose: 0, bpm: 108 },
  },
  frost: {
    id: 'frost',
    debris: 'rock',
    overlay: { color: 0x07142a, alpha: 0.38 },
    groundSpeed: 80,
    weather: 'snow',
    asteroidTint: 0xa8e4ff,
    crystalTint: 0xd6f6ff,
    crystalName: 'Grab the ice crystals!',
    asteroidName: 'Iceberg field!',
    asteroidHint: 'Icebergs! Dodge them or blast them!',
    music: { transpose: 2, bpm: 104 },
  },
  dune: {
    id: 'dune',
    debris: 'rock',
    overlay: { color: 0x1a0c04, alpha: 0.38 },
    groundSpeed: 90,
    weather: 'sand',
    asteroidTint: 0xe0b080,
    crystalTint: 0xfff0b0,
    crystalName: 'Grab the desert gems!',
    asteroidName: 'Sandstorm!',
    asteroidHint: 'Sandstorm! Dodge the rocks or blast them!',
    music: { transpose: -3, bpm: 116 },
  },
  forest: {
    id: 'forest',
    debris: 'rock',
    overlay: { color: 0x020a06, alpha: 0.3 },
    groundSpeed: 75,
    weather: 'fireflies',
    asteroidTint: 0xc8b090,
    crystalTint: 0xd8ffb0,
    crystalName: 'Grab the glow seeds!',
    asteroidName: 'Falling rocks!',
    asteroidHint: 'Rocks from the cliffs! Dodge them or blast them!',
    music: { transpose: 5, bpm: 110 },
  },
  hull: {
    id: 'hull',
    debris: 'junk',
    overlay: { color: 0x000000, alpha: 0.2 },
    groundSpeed: 120,
    weather: 'dust',
    asteroidTint: 0x9aa6b8,
    crystalTint: 0xffb060,
    crystalName: 'Grab the power cells!',
    asteroidName: 'Debris field!',
    asteroidHint: 'Space junk! Dodge it or blast it!',
    music: { transpose: -5, bpm: 120 },
  },
  tropic: {
    id: 'tropic',
    debris: 'rock',
    overlay: { color: 0x02121c, alpha: 0.36 },
    groundSpeed: 85,
    weather: 'rain',
    asteroidTint: 0xc8b89a,
    crystalTint: 0xbaffef,
    crystalName: 'Grab the sea pearls!',
    asteroidName: 'Tumbling rocks!',
    asteroidHint: 'Rocks from the cliffs! Dodge them or blast them!',
    music: { transpose: 3, bpm: 114 },
  },
  deathstar: {
    id: 'deathstar',
    debris: 'junk',
    overlay: { color: 0x000000, alpha: 0.32 },
    groundSpeed: 110,
    weather: 'none',
    asteroidTint: 0xffffff,
    crystalTint: 0xffb060,
    crystalName: 'Grab the power cells!',
    asteroidName: 'Space junk!',
    asteroidHint: 'Space junk! Dodge it or blast it!',
    music: { transpose: -7, bpm: 126 },
  },
};

export function generateThemeTextures(scene: Phaser.Scene): void {
  const add = (key: string, canvas: HTMLCanvasElement): void => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  add(THEME_TEX.terrain('moon'), moonTerrain().toCanvas());
  add(THEME_TEX.terrain('frost'), frostTerrain().toCanvas());
  add(THEME_TEX.terrain('dune'), duneTerrain().toCanvas());
  add(THEME_TEX.terrain('forest'), forestTerrain().toCanvas());
  add(THEME_TEX.terrain('hull'), hullTerrain().toCanvas());
  add(THEME_TEX.terrain('tropic'), tropicTerrain().toCanvas());
  add(THEME_TEX.terrain('deathstar'), deathStarTerrain().toCanvas());
  add(THEME_TEX.planet('hull'), stationSprite().toCanvas());
  for (const t of ['moon', 'frost', 'dune', 'forest', 'tropic'] as const) add(THEME_TEX.planet(t), planetSprite(t).toCanvas());
  add(THEME_TEX.star, starGrid().toCanvas());
}
