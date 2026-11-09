import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { THEME_TEX, THEMES, type Theme } from '../art/themes';
import { TERRAIN_SIZE } from '../art/terrain';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import type { ThemeId } from '../progression/campaign';
import { Starfield } from './Starfield';

/** Anything that can sit behind gameplay and scroll. */
export interface Backdrop {
  speed: number;
  sway: number;
  update(dt: number): void;
  /** Heavier weather during interludes (sandstorm, blizzard…). */
  setStorm(on: boolean): void;
}

const GROUND_SCALE = 4;

/** Low flight over a planet surface, with weather. */
class PlanetSurface implements Backdrop {
  speed = 1;
  sway = 0;
  private ground: Phaser.GameObjects.TileSprite;
  private theme: Theme;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private baseFrequency = 0;

  constructor(scene: Phaser.Scene, themeId: ThemeId) {
    this.theme = THEMES[themeId];
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0).setDepth(-100);
    this.ground = scene.add
      .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, THEME_TEX.terrain(themeId))
      .setOrigin(0)
      .setTileScale(GROUND_SCALE)
      .setDepth(-95);
    const o = this.theme.overlay;
    scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, o.color, o.alpha).setOrigin(0).setDepth(-90);
    // Darker band behind the HUD at the top for readability.
    const shade = scene.add.graphics().setDepth(-89);
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    shade.fillRect(0, 0, GAME_WIDTH, 220);
    this.weather = this.makeWeather(scene);
  }

  private makeWeather(scene: Phaser.Scene): Phaser.GameObjects.Particles.ParticleEmitter | null {
    let e: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
    switch (this.theme.weather) {
      case 'snow':
        e = scene.add.particles(0, 0, TEX.pixel, {
          x: { min: 0, max: GAME_WIDTH },
          y: -10,
          speedY: { min: 60, max: 150 },
          speedX: { min: -30, max: 30 },
          scale: { min: 0.5, max: 1.3 },
          alpha: { min: 0.5, max: 0.95 },
          lifespan: 9000,
          frequency: 45,
        });
        this.baseFrequency = 45;
        break;
      case 'sand':
        e = scene.add.particles(0, 0, TEX.pixel, {
          x: -10,
          y: { min: 0, max: GAME_HEIGHT },
          speedX: { min: 220, max: 420 },
          speedY: { min: 20, max: 90 },
          scale: { min: 0.4, max: 1 },
          alpha: { start: 0.6, end: 0.1 },
          tint: [0xe8c088, 0xd9a565, 0xf3d8a8],
          lifespan: 5000,
          frequency: 30,
        });
        this.baseFrequency = 30;
        break;
      case 'fireflies':
        e = scene.add.particles(0, 0, TEX.spark, {
          x: { min: 0, max: GAME_WIDTH },
          y: { min: 0, max: GAME_HEIGHT },
          speedX: { min: -20, max: 20 },
          speedY: { min: -20, max: 30 },
          scale: { start: 0.2, end: 0.6 },
          alpha: { start: 0, end: 0.9, ease: 'Sine.easeInOut' },
          tint: [0xdfff7a, 0xa8ff6a, 0xfff29a],
          lifespan: 2400,
          frequency: 160,
          blendMode: Phaser.BlendModes.ADD,
        });
        this.baseFrequency = 160;
        break;
      case 'dust':
        e = scene.add.particles(0, 0, TEX.pixel, {
          x: { min: 0, max: GAME_WIDTH },
          y: -10,
          speedY: { min: 200, max: 320 },
          scale: { min: 0.3, max: 0.7 },
          alpha: { min: 0.2, max: 0.5 },
          tint: 0xb8bfd8,
          lifespan: 4000,
          frequency: 90,
        });
        this.baseFrequency = 90;
        break;
      default:
        return null;
    }
    e.setDepth(30);
    return e;
  }

  setStorm(on: boolean): void {
    if (this.weather) this.weather.frequency = on ? Math.max(6, this.baseFrequency / 4) : this.baseFrequency;
  }

  update(dt: number): void {
    const s = dt / 1000;
    this.ground.tilePositionY -= ((this.theme.groundSpeed * this.speed) / GROUND_SCALE) * s;
    this.ground.tilePositionX += (this.sway * 30 * s) / GROUND_SCALE;
    // Keep the numbers small so precision never degrades in long sessions.
    this.ground.tilePositionY %= TERRAIN_SIZE;
    this.ground.tilePositionX %= TERRAIN_SIZE;
  }
}

class SpaceBackdrop implements Backdrop {
  private field: Starfield;
  constructor(scene: Phaser.Scene) {
    this.field = new Starfield(scene);
  }
  get speed(): number {
    return this.field.speed;
  }
  set speed(v: number) {
    this.field.speed = v;
  }
  get sway(): number {
    return this.field.sway;
  }
  set sway(v: number) {
    this.field.sway = v;
  }
  setStorm(): void {
    /* nothing to do in open space */
  }
  update(dt: number): void {
    this.field.update(dt);
  }
}

export function createBackdrop(scene: Phaser.Scene, theme: ThemeId | 'space'): Backdrop {
  return theme === 'space' ? new SpaceBackdrop(scene) : new PlanetSurface(scene, theme);
}
