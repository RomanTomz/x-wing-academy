import Phaser from 'phaser';
import { PIXEL_SCALE, shipTexture, TEX } from '../art/textures';
import { COLORS, FONTS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, speech, store } from '../core/services';
import { InputController } from '../input/InputController';
import type { MissionStats } from '../progression/mission';
import type { MissionResult } from '../persistence/gameStore';
import { rankForXp } from '../progression/xp';
import type { Unlock } from '../progression/unlocks';
import { Starfield } from '../ui/Starfield';
import { placeIcon, THEME_TEX } from '../art/themes';
import { isMissionConfig, LEVEL_NAMES, LEVELS, planetById, QUICK_MISSION, type Faction, type MissionConfig, type Planet } from '../progression/campaign';
import { REGISTRY } from './GalaxyMapScene';
import { Button, MenuNav, panel, pixelText, roundText } from '../ui/widgets';

interface CompleteData {
  stats: MissionStats;
  result: MissionResult;
  config?: MissionConfig;
}

function encouragement(stats: MissionStats, name: string): string {
  if (stats.accuracy >= 0.9) return `Incredible flying, ${name}! You're a true ace!`;
  if (stats.accuracy >= 0.7) return `Brilliant work, ${name}! The fleet is proud of you!`;
  if (stats.accuracy >= 0.4) return `Great job, ${name}! Every mission makes you stronger!`;
  return `You never gave up, ${name}! That's what real pilots do!`;
}

/** Mission success screen: stats, XP tally, rank progress and unlock reveal. */
export class CompleteScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private nav: MenuNav | null = null;
  private fireworks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private config: MissionConfig = QUICK_MISSION;
  private faction: Faction = 'rebel';

  constructor() {
    super(SCENES.complete);
  }

  create(data: CompleteData): void {
    this.nav = null;
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(600, 255, 255, 255);
    audio.playMusic('menu');
    audio.setEngine(-1);
    const { stats, result } = data;
    this.config = isMissionConfig(data.config) ? data.config : QUICK_MISSION;
    const planet = this.config.mode === 'campaign' ? planetById(this.config.planetId) : undefined;
    const opened = [result.planetUnlocked?.id, result.bossUnlocked?.id].filter((id): id is NonNullable<typeof id> => id !== undefined);
    if (opened.length > 0) this.registry.set(REGISTRY.justUnlocked, opened);
    const name = store.settings.pilotName;

    this.fireworks = this.add.particles(0, 0, TEX.spark, {
      speed: { min: 100, max: 360 },
      lifespan: 1300,
      scale: { start: 1.3, end: 0 },
      gravityY: 140,
      tint: [0xffd23f, 0x7fe8ff, 0xff5ab4, 0x5dff9a, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.fireworks.setDepth(1);
    const burst = (): void => {
      this.fireworks.explode(50, Phaser.Math.Between(150, GAME_WIDTH - 150), Phaser.Math.Between(100, 350));
    };
    burst();
    this.time.addEvent({ delay: 650, repeat: 6, callback: burst });

    // Victory lap.
    const empire = (planet?.faction ?? store.faction) === 'empire';
    this.faction = empire ? 'empire' : 'rebel';
    // Rebel ships are drawn from above (turn them to fly right); TIEs are drawn from the front.
    const ship = this.add.image(-100, 300, shipTexture(store.loadout(this.faction))).setScale(empire ? 2.3 : PIXEL_SCALE).setAngle(empire ? 0 : 90).setDepth(2);
    this.tweens.add({ targets: ship, x: GAME_WIDTH + 150, duration: 2400, ease: 'Sine.easeInOut', delay: 200 });
    this.tweens.add({ targets: ship, y: 220, duration: 1200, yoyo: true, ease: 'Sine.easeInOut', delay: 200 });

    audio.play('fanfare');
    const title = pixelText(this, GAME_WIDTH / 2, 70, 'MISSION COMPLETE!', 46, COLORS.textGold).setScale(0).setDepth(5);
    this.tweens.add({ targets: title, scale: 1, duration: 600, ease: 'Back.easeOut', delay: 200 });
    if (planet && this.config.mode === 'campaign') this.drawStars(planet, this.config.level, result.newStar);
    else {
      const medal = this.add.image(GAME_WIDTH / 2, 160, TEX.medal).setScale(0).setDepth(5);
      this.tweens.add({ targets: medal, scale: PIXEL_SCALE, angle: { from: -30, to: 0 }, duration: 700, ease: 'Back.easeOut', delay: 600 });
    }
    const encourage = encouragement(stats, name);
    roundText(this, GAME_WIDTH / 2, 248, encourage, 32, COLORS.text).setDepth(5);
    this.time.delayedCall(1600, () => speech.speak(`Mission complete! ${encourage}`));

    // Stats panel.
    panel(this, 365, 420, 520, 250).setDepth(4);
    const rows: [string, string][] = [
      ['Targets found', `${stats.questionsCompleted} / ${stats.totalQuestions}`],
      ['Sharpshooter', ''],
      ['Crystals collected', `${stats.crystals}`],
    ];
    this.drawSharpshooter(stats.firstTryLog, 382 + 17);
    rows.forEach(([label, value], i) => {
      const y = 330 + i * 52;
      this.add.text(135, y, label, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '28px', color: COLORS.textDim }).setDepth(5).setAlpha(0);
      this.add.text(600, y, value, { fontFamily: FONTS.round, fontStyle: '700', fontSize: '30px', color: COLORS.text }).setOrigin(1, 0).setDepth(5).setAlpha(0);
    });
    this.children.list
      .filter((o): o is Phaser.GameObjects.Text => o instanceof Phaser.GameObjects.Text && o.alpha === 0)
      .forEach((t, i) => this.tweens.add({ targets: t, alpha: 1, delay: 900 + Math.floor(i / 2) * 250, duration: 250 }));

    // XP tally.
    this.add.text(135, 488, 'XP earned', { fontFamily: FONTS.round, fontStyle: '600', fontSize: '30px', color: COLORS.textGold }).setDepth(5);
    const xpText = this.add
      .text(600, 484, '+0', { fontFamily: FONTS.pixel, fontSize: '30px', color: COLORS.textGold, stroke: COLORS.stroke, strokeThickness: 6 })
      .setOrigin(1, 0)
      .setDepth(5);
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: stats.xpEarned,
      delay: 1700,
      duration: 1400,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        xpText.setText(`+${Math.round(counter.v)}`);
        if (Math.random() < 0.3) audio.play('tick');
      },
    });

    // Rank progress.
    this.drawRank(result, 1700);

    // Reveals, one after another so cards never overlap.
    let at = 3200;
    for (const reward of result.newUnlocks) {
      this.time.delayedCall(at, () => this.revealUnlock(reward));
      at += 3600;
    }
    const newPlanet = result.planetUnlocked;
    if (newPlanet) {
      this.time.delayedCall(at, () => this.revealPlanet(newPlanet));
      at += 3600;
    }
    const newBoss = result.bossUnlocked;
    if (newBoss) {
      this.time.delayedCall(at, () => this.revealPlanet(newBoss));
      at += 3600;
    }

    this.time.delayedCall(Math.max(2600, at - 3000), () => {
      const again = new Button(this, 175, 660, 'FLY AGAIN', () => this.go(SCENES.briefing, this.config), { width: 290, height: 72, size: 18, color: COLORS.gold });
      const map = new Button(this, 485, 660, this.faction === 'empire' ? 'IMPERIAL MAP' : 'GALAXY MAP', () => this.go(SCENES.map, { faction: this.faction }), {
        width: 290,
        height: 72,
        size: 18,
        color: newPlanet ? 0x5dff9a : COLORS.hud,
      });
      const hangar = new Button(this, 795, 660, 'HANGAR', () => this.go(SCENES.hangar), { width: 290, height: 72, size: 18 });
      const home = new Button(this, 1105, 660, 'HOME', () => this.go(SCENES.menu), { width: 290, height: 72, size: 18 });
      const buttons = [again, map, hangar, home];
      for (const b of buttons) {
        b.setDepth(10).setAlpha(0);
        this.tweens.add({ targets: b, alpha: 1, duration: 300 });
      }
      // After unlocking a planet, point straight at the map.
      this.nav = new MenuNav(this.input2, buttons, { columns: 4, start: newPlanet ? 1 : 0 });
    });
  }

  /** One medal per question: gold for a first-shot hit, dim for got-there-in-the-end. */
  private drawSharpshooter(log: readonly boolean[], y: number): void {
    const right = 600;
    const left = 330;
    const n = Math.max(1, log.length);
    const step = Math.min(26, (right - left) / n);
    const scale = Math.min(1.3, step / 18);
    log.forEach((hit, i) => {
      const x = right - (n - 1 - i) * step - 8;
      const star = this.add.image(x, y, THEME_TEX.star).setScale(0).setDepth(5).setTint(hit ? 0xffffff : 0x3a4560);
      this.tweens.add({
        targets: star,
        scale,
        duration: 260,
        delay: 1150 + i * 70,
        ease: 'Back.easeOut',
        onStart: () => {
          if (hit) audio.play('tick');
        },
      });
    });
  }

  private drawRank(result: MissionResult, delay: number): void {
    const x = 920;
    panel(this, x, 420, 480, 250).setDepth(4);
    const info = rankForXp(store.data.profile.totalXp);
    this.add.text(x, 322, 'PILOT RANK', { fontFamily: FONTS.pixel, fontSize: '14px', color: COLORS.textDim }).setOrigin(0.5).setDepth(5);
    const rankName = roundText(this, x, 366, result.rankBefore.name, 40, COLORS.textGold).setDepth(5);
    const bar = this.add.graphics().setDepth(5);
    const draw = (p: number): void => {
      bar.clear();
      bar.fillStyle(0x0b2238, 1);
      bar.fillRoundedRect(x - 200, 410, 400, 28, 12);
      bar.fillStyle(COLORS.gold, 1);
      bar.fillRoundedRect(x - 200, 410, Math.max(28, 400 * p), 28, 12);
    };
    draw(0);
    const nextText = info.next ? `${info.next.xp - store.data.profile.totalXp} XP to ${info.next.name}` : 'Top rank reached!';
    this.add.text(x, 470, nextText, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '24px', color: COLORS.text }).setOrigin(0.5).setDepth(5);
    this.add.text(x, 506, `Total XP: ${store.data.profile.totalXp}`, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '22px', color: COLORS.textDim }).setOrigin(0.5).setDepth(5);
    const prog = { p: 0 };
    this.tweens.add({ targets: prog, p: info.progress, delay, duration: 1400, ease: 'Quad.easeOut', onUpdate: () => draw(prog.p) });
    if (result.rankUp) {
      this.time.delayedCall(delay + 1500, () => {
        rankName.setText(result.rankAfter.name);
        rankName.setScale(1.6);
        this.tweens.add({ targets: rankName, scale: 1, duration: 500, ease: 'Back.easeOut' });
        audio.play('levelup');
        this.fireworks.explode(60, x, 366);
        const promo = pixelText(this, x, 286, 'PROMOTED!', 22, '#5dff9a').setDepth(6);
        this.tweens.add({ targets: promo, y: 280, duration: 500, yoyo: true, repeat: -1 });
      });
    }
  }

  /** Row of three stars for this planet; the newly earned one pops in. */
  private drawStars(planet: Planet, level: 1 | 2 | 3, newStar: boolean): void {
    const cleared = store.data.profile.campaign[planet.id].cleared;
    LEVELS.forEach((lvl, k) => {
      const x = GAME_WIDTH / 2 + (k - 1) * 70;
      const star = this.add.image(x, 156, THEME_TEX.star).setScale(0).setDepth(5);
      const earned = cleared[lvl - 1];
      star.setTint(earned ? 0xffffff : 0x343a50);
      const isNew = newStar && lvl === level;
      this.tweens.add({
        targets: star,
        scale: 3.4,
        angle: isNew ? { from: -180, to: 0 } : 0,
        duration: isNew ? 800 : 400,
        delay: isNew ? 1300 : 500 + k * 120,
        ease: 'Back.easeOut',
        onStart: () => {
          if (isNew) {
            audio.play('levelup');
            this.fireworks.explode(40, x, 156);
          }
        },
      });
    });
    const label = newStar ? `${planet.name}: ${LEVEL_NAMES[level]} star earned!` : `${planet.name}: ${LEVEL_NAMES[level]} level`;
    roundText(this, GAME_WIDTH / 2, 206, label, 22, newStar ? '#5dff9a' : COLORS.textDim).setDepth(5);
  }

  private revealPlanet(p: Planet): void {
    const boss = p.kind === 'boss';
    this.showCard(
      p.final ? 'FINAL BOSS UNLOCKED!' : boss ? 'BOSS BATTLE UNLOCKED!' : 'NEW PLANET!',
      boss ? 0xff4a4a : 0x7fe8ff,
      this.add.image(0, -10, placeIcon(p)).setScale(boss ? 2.6 : 2.4),
      p.name,
      `Find it on the ${p.faction === 'empire' ? 'Imperial' : 'Galaxy'} Map!`,
    );
    speech.speak(`${boss ? 'Boss battle unlocked' : 'New planet unlocked'}! ${p.name}!`, { interrupt: false });
  }

  private revealUnlock(u: Unlock): void {
    let icon: Phaser.GameObjects.Image;
    if (u.kind === 'droid') icon = this.add.image(0, -10, TEX.droid).setScale(6);
    else if (u.kind === 'paint') icon = this.add.image(0, -10, TEX.ship(u.id, store.loadout(this.faction).ship)).setScale(2.6);
    else if (u.kind === 'laser') icon = this.add.image(0, -10, TEX.laser(u.id)).setScale(2.2).setAngle(30);
    else icon = this.add.image(0, -10, TEX.spark).setScale(6).setTint(u.color);
    this.showCard('NEW REWARD!', u.color, icon, u.name, u.kind === 'droid' ? 'BIP-8 will fly with you!' : 'Equip it in the Hangar!');
    speech.speak(`New reward! ${u.name}!`, { interrupt: false });
  }

  private showCard(heading: string, color: number, icon: Phaser.GameObjects.Image, title: string, tipText: string): void {
    audio.play('unlock');
    const card = this.add.container(GAME_WIDTH / 2, 420).setDepth(20);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH * 2, 1500, 0x000814, 0.6);
    const bg = this.add.graphics();
    bg.fillStyle(0x10203a, 0.97);
    bg.fillRoundedRect(-300, -170, 600, 340, 22);
    bg.lineStyle(5, COLORS.gold, 1);
    bg.strokeRoundedRect(-300, -170, 600, 340, 22);
    const head = pixelText(this, 0, -130, heading, 26, COLORS.textGold);
    const glow = this.add.image(0, -10, TEX.flare).setScale(1.6).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    const name = roundText(this, 0, 100, title, 36, COLORS.text);
    const tip = roundText(this, 0, 140, tipText, 22, COLORS.textDim);
    card.add([dim, bg, glow, icon, head, name, tip]);
    card.setScale(0);
    this.tweens.add({ targets: card, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets: glow, angle: 360, duration: 4000, repeat: -1 });
    this.tweens.add({ targets: icon, y: -20, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.fireworks.explode(80, GAME_WIDTH / 2, 400);
    const close = (): void => {
      this.tweens.add({ targets: card, scale: 0, alpha: 0, duration: 250, onComplete: () => card.destroy() });
    };
    this.time.delayedCall(3200, close);
    dim.setInteractive().on('pointerdown', close);
  }

  private go(key: string, data?: object): void {
    speech.cancel();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  override update(_time: number, delta: number): void {
    this.starfield.update(delta);
    this.input2.update();
    this.nav?.update();
  }
}
