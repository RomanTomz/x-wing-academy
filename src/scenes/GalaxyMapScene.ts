import Phaser from 'phaser';
import { shipTexture, TEX } from '../art/textures';
import { placeIcon, THEME_TEX } from '../art/themes';
import { COLORS, FONTS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, speech, store } from '../core/services';
import { InputController } from '../input/InputController';
import { bossesFor, chainFor, isFaction, LEVELS, planetById, type Faction, type Level, type MissionConfig, type Planet, type PlanetId } from '../progression/campaign';
import { Starfield } from '../ui/Starfield';
import { createLevelPicker } from '../ui/LevelPicker';
import { MenuNav, panel, pixelText, roundText } from '../ui/widgets';

const SPOTS: readonly [number, number][] = [
  // Spread out so boss battles fit on the route between planets.
  [130, 450],
  [470, 250],
  [790, 450],
  [1050, 250],
];
/** Where each career's final boss waits, after the last planet. */
const FINAL_SPOT: [number, number] = [1185, 470];

const STYLE: Record<Faction, { title: string; color: string; sub: string; accent: number }> = {
  rebel: { title: 'GALAXY MAP', color: COLORS.textGold, sub: 'Pick a planet to defend!', accent: COLORS.gold },
  empire: { title: 'IMPERIAL MAP', color: '#ff8a8a', sub: 'Pick a rebel base to attack!', accent: 0xff5a5a },
};

export interface MapData {
  faction?: Faction;
}

export const REGISTRY = {
  lastPlanet: 'map.lastPlanet',
  justUnlocked: 'map.justUnlocked',
} as const;

interface PlanetView {
  planet: Planet;
  /** Size of the selection ring for this stop. */
  ringScale: number;
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
  private faction: Faction = 'rebel';

  constructor() {
    super(SCENES.map);
  }

  create(data?: MapData): void {
    this.faction = isFaction(data?.faction) ? data.faction : store.faction;
    store.setFaction(this.faction);
    const style = STYLE[this.faction];
    const planets = chainFor(this.faction);
    const bosses = bossesFor(this.faction);
    this.views = [];
    this.picker = null;
    this.pickerNav = null;
    this.t = 0;
    this.leaving = false;
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    audio.playMusic('menu', this.faction === 'empire' ? { transpose: -5, bpm: 90 } : undefined);
    audio.setEngine(-1);

    pixelText(this, GAME_WIDTH / 2, 56, style.title, 38, style.color);
    roundText(this, GAME_WIDTH / 2, 104, style.sub, 26, COLORS.textDim);

    this.drawPath(planets, bosses.find((b) => b.final));
    // Map order: each planet, then any boss battle that sits after it on the route.
    planets.forEach((p, i) => {
      const [x, y] = SPOTS[i];
      this.views.push(this.makePlanet(p, this.views.length, x, y));
      const next = SPOTS[i + 1];
      for (const boss of bosses.filter((b) => b.unlockAfter === p.id)) {
        // Final bosses wait after the last planet; others sit halfway along the arc to the next planet.
        if (boss.final || !next) this.views.push(this.makePlanet(boss, this.views.length, FINAL_SPOT[0], FINAL_SPOT[1]));
        else this.views.push(this.makePlanet(boss, this.views.length, (x + next[0]) / 2, (y + next[1]) / 2 - 30));
      }
    });

    this.ring = this.add.image(0, 0, TEX.ring).setTint(style.accent).setAlpha(0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    this.cursor = this.add.image(0, 0, shipTexture(store.loadout(this.faction))).setScale(1.3).setDepth(8);

    panel(this, GAME_WIDTH / 2, 655, 760, 92, COLORS.hud, 0.85).setDepth(9);
    this.info = roundText(this, GAME_WIDTH / 2, 638, '', 32, COLORS.text).setDepth(10);
    this.sub = roundText(this, GAME_WIDTH / 2, 676, '', 22, COLORS.textDim).setDepth(10);

    const back = this.add
      .text(28, 24, '◀ BACK', { fontFamily: FONTS.pixel, fontSize: '16px', color: COLORS.textDim })
      .setInteractive({ useHandCursor: true })
      .setDepth(10);
    back.on('pointerdown', () => this.leave(SCENES.menu));

    // Start on the last place flown, or the newest planet unlocked.
    const indexOf = (id: string): number => this.views.findIndex((v) => v.planet.id === id);
    const last = this.registry.get(REGISTRY.lastPlanet) as PlanetId | undefined;
    let start = this.views.reduce((best, v, i) => (v.planet.kind === 'planet' && store.isPlanetUnlocked(v.planet.id) ? i : best), 0);
    if (last && indexOf(last) >= 0 && store.isPlanetUnlocked(last)) start = indexOf(last);

    const unlocked = (this.registry.get(REGISTRY.justUnlocked) as PlanetId[] | undefined) ?? [];
    this.registry.remove(REGISTRY.justUnlocked);
    unlocked.forEach((id, k) => {
      const i = indexOf(id);
      if (i < 0) return;
      if (k === 0) start = i;
      this.time.delayedCall(k * 1400, () => this.playUnlock(this.views[i]));
    });
    this.select(start, false);
  }

  private drawPath(planets: readonly Planet[], finalBoss: Planet | undefined): void {
    const g = this.add.graphics().setDepth(1);
    const legs: { from: [number, number]; to: [number, number]; open: boolean; color: number }[] = [];
    for (let i = 0; i < planets.length - 1; i++) {
      legs.push({ from: SPOTS[i] as [number, number], to: SPOTS[i + 1] as [number, number], open: store.isPlanetUnlocked(planets[i + 1].id), color: COLORS.hud });
    }
    if (finalBoss) {
      const last = SPOTS[planets.length - 1] as [number, number];
      legs.push({ from: last, to: FINAL_SPOT, open: store.isPlanetUnlocked(finalBoss.id), color: 0xff5a5a });
    }
    for (const { from: [x0, y0], to: [x1, y1], open, color } of legs) {
      g.fillStyle(open ? color : 0x3a4a66, open ? 0.9 : 0.6);
      const steps = 16;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        // Gentle arc between stops.
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 30;
        g.fillCircle(x, y, 4);
      }
    }
  }

  private makePlanet(p: Planet, i: number, x: number, y: number): PlanetView {
    const boss = p.kind === 'boss';
    const open = store.isPlanetUnlocked(p.id);
    const glow = this.add.image(x, y, TEX.flare).setScale(boss ? 1.3 : 2).setAlpha(open ? 0.35 : 0.08).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    const glows: Partial<Record<Planet['theme'], number>> = { frost: 0x9fdcff, dune: 0xffb060, forest: 0x7aff9a, tropic: 0x5fe8e0 };
    glow.setTint(boss ? 0xff4a4a : (glows[p.theme] ?? 0xc8c8ff));
    const sprite = this.add.image(x, y, placeIcon(p)).setScale(boss ? 1.7 : 2.1).setDepth(3);
    if (!open) sprite.setTint(0x4a5070);
    const lock = this.add.image(x, y, TEX.lock).setScale(boss ? 3 : 4).setDepth(5).setVisible(!open);
    if (boss) pixelText(this, x, y - 56, p.final ? 'FINAL BOSS' : 'BOSS', 12, open ? '#ff6b6b' : '#6b4a55').setDepth(5);
    const nameY = boss ? y + 52 : y + 98;
    const name = roundText(this, x, nameY, p.name, boss ? 20 : 28, open ? COLORS.text : '#5d6b85').setDepth(5);
    const cleared = store.data.profile.campaign[p.id].cleared;
    const starStep = boss ? 26 : 34;
    const stars = LEVELS.map((lvl, k) =>
      this.add
        .image(x - starStep + k * starStep, nameY + (boss ? 26 : 36), THEME_TEX.star)
        .setScale(boss ? 1.2 : 1.6)
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
    return { planet: p, ringScale: boss ? 1.05 : 1.45, sprite, lock, name, stars };
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
      this.tweens.add({ targets: v.sprite, scale: { from: v.sprite.scale * 1.25, to: v.sprite.scale }, duration: 700, ease: "Back.easeOut" });
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
      const boss = v.planet.kind === 'boss';
      const label = v.planet.final ? 'FINAL BOSS!' : boss ? 'BOSS UNLOCKED!' : 'NEW PLANET!';
      const t = pixelText(this, Math.min(v.sprite.x, GAME_WIDTH - 110), v.sprite.y + (boss ? 110 : 172), label, boss ? 14 : 20, boss ? '#ff8a8a' : '#5dff9a').setDepth(7);
      this.tweens.add({ targets: t, y: t.y - 14, duration: 500, yoyo: true, repeat: 3, onComplete: () => t.destroy() });
      speech.speak(`${boss ? 'Boss battle unlocked' : 'New planet unlocked'}! ${v.planet.name}!`, { interrupt: false });
    });
  }

  private select(i: number, sound: boolean): void {
    this.selected = Phaser.Math.Clamp(i, 0, this.views.length - 1);
    const v = this.views[this.selected];
    if (sound) audio.play('click');
    this.ring.setPosition(v.sprite.x, v.sprite.y);
    this.tweens.killTweensOf(this.cursor);
    const lift = v.planet.kind === 'boss' ? 104 : 112;
    this.tweens.add({ targets: this.cursor, x: v.sprite.x, y: v.sprite.y - lift, duration: sound ? 350 : 0, ease: 'Cubic.easeOut' });
    const open = store.isPlanetUnlocked(v.planet.id);
    const boss = v.planet.kind === 'boss';
    this.info.setText(open ? (boss ? `${v.planet.final ? 'Final battle' : 'Boss battle'}: ${v.planet.name}!` : `${v.planet.name}: ${v.planet.focus}`) : `${v.planet.name} is locked`);
    const prevPlanet =
      v.planet.kind === 'boss' ? planetById(v.planet.unlockAfter ?? '') : [...this.views.slice(0, this.selected)].reverse().find((x) => x.planet.kind === 'planet')?.planet;
    this.sub.setText(open ? (boss ? `${v.planet.focus} Press SPACE to attack!` : 'Press SPACE or click to fly there!') : `Win a mission on ${prevPlanet?.name ?? 'the last planet'} to open it!`);
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
    const picker = createLevelPicker(this, this.input2, p, {
      onPick: (lvl) => this.launch(p, lvl),
      onBack: () => this.closePicker(),
      accent: this.faction === 'empire' ? 0xff5a5a : undefined,
    });
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
      this.ring.setScale(v.ringScale + Math.sin(this.t * 4) * 0.06);
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
