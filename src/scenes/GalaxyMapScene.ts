import Phaser from 'phaser';
import { shipTexture, TEX } from '../art/textures';
import { THEME_TEX } from '../art/themes';
import { COLORS, FONTS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, speech, store } from '../core/services';
import { InputController } from '../input/InputController';
import { LEVELS, PLANETS, planetIndex, type Level, type MissionConfig, type Planet, type PlanetId } from '../progression/campaign';
import { Starfield } from '../ui/Starfield';
import { createLevelPicker } from '../ui/LevelPicker';
import { MenuNav, panel, pixelText, roundText } from '../ui/widgets';

const SPOTS: readonly [number, number][] = [
  [210, 430],
  [500, 265],
  [790, 440],
  [1075, 275],
];

export const REGISTRY = {
  lastPlanet: 'map.lastPlanet',
  justUnlocked: 'map.justUnlocked',
} as const;

interface PlanetView {
  planet: Planet;
  sprite: Phaser.GameObjects.Image;
  lock: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  stars: Phaser.GameObjects.Image[];
}

/** Choose a planet (unlocked one by one), then a level. */
export class GalaxyMapScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private views: PlanetView[] = [];
  private selected = 0;
  private cursor!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private info!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private picker: Phaser.GameObjects.Container | null = null;
  private pickerNav: MenuNav | null = null;
  private t = 0;
  private leaving = false;

  constructor() {
    super(SCENES.map);
  }

  create(): void {
    this.views = [];
    this.picker = null;
    this.pickerNav = null;
    this.t = 0;
    this.leaving = false;
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    audio.playMusic('menu');
    audio.setEngine(-1);

    pixelText(this, GAME_WIDTH / 2, 56, 'GALAXY MAP', 38, COLORS.textGold);
    roundText(this, GAME_WIDTH / 2, 104, 'Pick a planet to defend!', 26, COLORS.textDim);

    this.drawPath();
    PLANETS.forEach((p, i) => this.views.push(this.makePlanet(p, i)));

    this.ring = this.add.image(0, 0, TEX.ring).setTint(COLORS.gold).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    this.cursor = this.add.image(0, 0, shipTexture(store.data.profile.equipped)).setScale(1.3).setDepth(8);

    panel(this, GAME_WIDTH / 2, 655, 760, 92, COLORS.hud, 0.85).setDepth(9);
    this.info = roundText(this, GAME_WIDTH / 2, 638, '', 32, COLORS.text).setDepth(10);
    this.sub = roundText(this, GAME_WIDTH / 2, 676, '', 22, COLORS.textDim).setDepth(10);

    const back = this.add
      .text(28, 24, '◀ BACK', { fontFamily: FONTS.pixel, fontSize: '16px', color: COLORS.textDim })
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    back.on('pointerdown', () => this.leave(SCENES.menu));

    // Start on the last planet flown, or the newest one unlocked.
    const last = this.registry.get(REGISTRY.lastPlanet) as PlanetId | undefined;
    let start = PLANETS.reduce((best, p, i) => (store.isPlanetUnlocked(p.id) ? i : best), 0);
    if (last && store.isPlanetUnlocked(last)) start = planetIndex(last);

    const unlocked = this.registry.get(REGISTRY.justUnlocked) as PlanetId | undefined;
    this.registry.remove(REGISTRY.justUnlocked);
    if (unlocked && planetIndex(unlocked) >= 0) {
      start = planetIndex(unlocked);
      this.playUnlock(this.views[start]);
    }
    this.select(start, false);
  }

  private drawPath(): void {
    const g = this.add.graphics().setDepth(1);
    for (let i = 0; i < SPOTS.length - 1; i++) {
      const [x0, y0] = SPOTS[i];
      const [x1, y1] = SPOTS[i + 1];
      const open = store.isPlanetUnlocked(PLANETS[i + 1].id);
      g.fillStyle(open ? COLORS.hud : 0x3a4a66, open ? 0.9 : 0.6);
      const steps = 16;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        // Gentle arc between planets.
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 30;
        g.fillCircle(x, y, 4);
      }
    }
  }

  private makePlanet(p: Planet, i: number): PlanetView {
    const [x, y] = SPOTS[i];
    const open = store.isPlanetUnlocked(p.id);
    const glow = this.add.image(x, y, TEX.flare).setScale(2).setAlpha(open ? 0.35 : 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    glow.setTint(p.theme === 'frost' ? 0x9fdcff : p.theme === 'dune' ? 0xffb060 : p.theme === 'forest' ? 0x7aff9a : 0xc8c8ff);
    const sprite = this.add.image(x, y, THEME_TEX.planet(p.theme)).setScale(2.1).setDepth(3);
    if (!open) sprite.setTint(0x4a5070);
    const lock = this.add.image(x, y, TEX.lock).setScale(4).setDepth(5).setVisible(!open);
    const name = roundText(this, x, y + 98, p.name, 28, open ? COLORS.text : '#5d6b85').setDepth(5);
    const cleared = store.data.profile.campaign[p.id].cleared;
    const stars = LEVELS.map((lvl, k) =>
      this.add
        .image(x - 34 + k * 34, y + 134, THEME_TEX.star)
        .setScale(1.6)
        .setDepth(5)
        .setTint(cleared[lvl - 1] ? 0xffffff : 0x343a50)
        .setAlpha(open ? 1 : 0.4),
    );
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      if (this.picker) return;
      if (this.selected === i) this.choose();
      else this.select(i, true);
    });
    sprite.on('pointerover', () => !this.picker && this.selected !== i && this.select(i, true));
    return { planet: p, sprite, lock, name, stars };
  }

  private playUnlock(v: PlanetView): void {
    v.sprite.setTint(0x4a5070);
    v.lock.setVisible(true);
    v.name.setColor('#5d6b85');
    this.time.delayedCall(700, () => {
      audio.play('unlock');
      this.tweens.add({ targets: v.lock, y: v.lock.y - 60, alpha: 0, angle: 30, duration: 600, ease: 'Quad.easeIn', onComplete: () => v.lock.setVisible(false) });
      v.sprite.clearTint();
      v.name.setColor(COLORS.text);
      this.tweens.add({ targets: v.sprite, scale: { from: 2.6, to: 2.1 }, duration: 700, ease: 'Back.easeOut' });
      const burst = this.add.particles(v.sprite.x, v.sprite.y, TEX.spark, {
        speed: { min: 80, max: 300 },
        lifespan: 1000,
        scale: { start: 1.2, end: 0 },
        tint: [0xffd23f, 0x7fe8ff, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      });
      burst.setDepth(6);
      burst.explode(70);
      const t = pixelText(this, v.sprite.x, v.sprite.y + 172, 'NEW PLANET!', 20, '#5dff9a').setDepth(7);
      this.tweens.add({ targets: t, y: t.y - 14, duration: 500, yoyo: true, repeat: 3, onComplete: () => t.destroy() });
      speech.speak(`New planet unlocked! ${v.planet.name}!`);
    });
  }

  private select(i: number, sound: boolean): void {
    this.selected = Phaser.Math.Clamp(i, 0, this.views.length - 1);
    const v = this.views[this.selected];
    if (sound) audio.play('click');
    this.ring.setPosition(v.sprite.x, v.sprite.y);
    this.tweens.killTweensOf(this.cursor);
    this.tweens.add({ targets: this.cursor, x: v.sprite.x, y: v.sprite.y - 112, duration: sound ? 350 : 0, ease: 'Cubic.easeOut' });
    const open = store.isPlanetUnlocked(v.planet.id);
    this.info.setText(open ? `${v.planet.name}: ${v.planet.focus}` : `${v.planet.name} is locked`);
    const prev = PLANETS[this.selected - 1];
    this.sub.setText(open ? 'Press SPACE or click to fly there!' : `Win a mission on ${prev?.name ?? 'the last planet'} to open it!`);
  }

  private choose(): void {
    const v = this.views[this.selected];
    if (!store.isPlanetUnlocked(v.planet.id)) {
      audio.play('bump');
      this.tweens.add({ targets: v.lock, x: v.lock.x + 8, duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    this.openPicker(v.planet);
  }

  private openPicker(p: Planet): void {
    audio.play('select');
    const picker = createLevelPicker(this, this.input2, p, { onPick: (lvl) => this.launch(p, lvl), onBack: () => this.closePicker() });
    this.picker = picker.container;
    this.pickerNav = picker.nav;
  }

  private closePicker(): void {
    this.picker?.destroy();
    this.picker = null;
    this.pickerNav = null;
    this.input2.clear();
  }

  private launch(p: Planet, level: Level): void {
    if (this.leaving) return;
    const config: MissionConfig = { mode: 'campaign', planetId: p.id, level };
    this.registry.set(REGISTRY.lastPlanet, p.id);
    this.leave(SCENES.briefing, config);
  }

  private leave(key: string, data?: MissionConfig): void {
    if (this.leaving) return;
    this.leaving = true;
    speech.cancel();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  override update(_time: number, delta: number): void {
    this.t += delta / 1000;
    this.starfield.update(delta);
    const v = this.views[this.selected];
    if (v) {
      this.ring.setScale(1.45 + Math.sin(this.t * 4) * 0.06);
      this.cursor.y += Math.sin(this.t * 3) * 0.3;
    }
    for (const view of this.views) view.sprite.rotation = Math.sin(this.t * 0.3 + view.sprite.x) * 0.03;
    this.input2.update();
    if (this.picker) {
      if (this.input2.consume('back')) {
        this.closePicker();
        return;
      }
      this.pickerNav?.update();
      return;
    }
    if (this.input2.consume('back')) {
      this.leave(SCENES.menu);
      return;
    }
    if (this.input2.consume('right') || this.input2.consume('down')) this.select(this.selected + 1, true);
    if (this.input2.consume('left') || this.input2.consume('up')) this.select(this.selected - 1, true);
    if (this.input2.consume('confirm')) this.choose();
  }
}
