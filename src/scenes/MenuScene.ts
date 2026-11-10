import Phaser from 'phaser';
import { PIXEL_SCALE, shipTexture, TEX } from '../art/textures';
import { trailTints } from '../entities/Player';
import { COLORS, FONTS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, store } from '../core/services';
import { InputController } from '../input/InputController';
import { nextUnlock } from '../progression/unlocks';
import { QUICK_MISSION, type Faction } from '../progression/campaign';
import { rankForXp } from '../progression/xp';
import { openParentPanel } from '../ui/ParentPanel';
import { Starfield } from '../ui/Starfield';
import { Button, MenuNav, panel, pixelText, roundText } from '../ui/widgets';

export class MenuScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private nav!: MenuNav;
  private ship!: Phaser.GameObjects.Image;
  private enemies: Phaser.GameObjects.Image[] = [];
  private t = 0;
  private panelOpen = false;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    this.t = 0;
    this.panelOpen = false;
    this.enemies = [];
    this.starfield = new Starfield(this);
    this.input2 = new InputController(this);
    audio.playMusic('menu');
    audio.setEngine(-1);
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Title.
    const title = pixelText(this, GAME_WIDTH / 2, 110, 'X-WING', 84, '#ffd23f');
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    grad.addColorStop(0, '#fff6c2');
    grad.addColorStop(0.5, '#ffd23f');
    grad.addColorStop(1, '#ff8a1f');
    title.setFill(grad);
    title.setStroke('#3a1600', 14);
    title.setShadow(0, 8, '#000000', 0, true, true);
    const sub = pixelText(this, GAME_WIDTH / 2, 196, 'ACADEMY', 40, '#7fe8ff');
    sub.setStroke('#04101f', 10);
    this.tweens.add({ targets: title, y: 104, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Decorative ships: your current starfighter, chased by the other side.
    const empire = store.faction === 'empire';
    this.ship = this.add.image(GAME_WIDTH / 2, 470, shipTexture(store.loadout())).setScale(empire ? 3.4 : PIXEL_SCALE * 1.5).setDepth(5);
    const trail = this.add.particles(0, 0, TEX.spark, {
      x: { min: -20, max: 20 },
      speedY: { min: 160, max: 280 },
      lifespan: 380,
      scale: { start: 1.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: trailTints(store.loadout().trail),
      frequency: 14,
      blendMode: Phaser.BlendModes.ADD,
    });
    trail.startFollow(this.ship, 0, empire ? 30 : 66);
    trail.setDepth(4);
    for (let i = 0; i < 3; i++) {
      const e = empire
        ? this.add.image(-200, 300, TEX.ship('paint-red', 'x-wing')).setScale(1.3).setAngle(90).setDepth(3).setAlpha(0.9)
        : this.add.image(-200, 300, TEX.enemy).setScale(1.4).setDepth(3).setAlpha(0.9);
      this.enemies.push(e);
    }

    // Pilot card.
    const profile = store.data.profile;
    const rank = rankForXp(profile.totalXp);
    panel(this, 230, 470, 380, 210, COLORS.hud, 0.75).setDepth(6);
    const helmet = this.add.image(90, 420, empire ? TEX.helmetImperial : TEX.helmet).setScale(3).setDepth(7);
    this.tweens.add({ targets: helmet, angle: { from: -4, to: 4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(140, 392, `PILOT ${store.settings.pilotName.toUpperCase()}`, { fontFamily: FONTS.pixel, fontSize: '16px', color: COLORS.text }).setDepth(7);
    this.add.text(140, 422, rank.rank.name, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '28px', color: COLORS.textGold }).setDepth(7);
    const bar = this.add.graphics().setDepth(7);
    bar.fillStyle(0x0b2238, 1);
    bar.fillRoundedRect(70, 478, 320, 22, 10);
    bar.fillStyle(COLORS.gold, 1);
    bar.fillRoundedRect(70, 478, Math.max(22, 320 * rank.progress), 22, 10);
    this.add
      .text(230, 489, rank.next ? `${profile.totalXp} / ${rank.next.xp} XP` : `${profile.totalXp} XP`, { fontFamily: FONTS.pixel, fontSize: '11px', color: '#ffffff', stroke: '#04101f', strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(8);
    const upcoming = nextUnlock(profile.missionsCompleted);
    const missionsText = `Missions flown: ${profile.missionsCompleted}`;
    const unlockText = upcoming
      ? `Next reward: ${upcoming.name} (${upcoming.missions - profile.missionsCompleted} more)`
      : 'All rewards unlocked!';
    this.add.text(70, 516, missionsText, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '20px', color: COLORS.text }).setDepth(7);
    this.add.text(70, 542, unlockText, { fontFamily: FONTS.round, fontStyle: '600', fontSize: '18px', color: COLORS.textDim, wordWrap: { width: 330 } }).setDepth(7);

    // Buttons.
    // Choose a side: each career has its own map, planets and bosses.
    roundText(this, GAME_WIDTH - 250, 300, 'Choose your side!', 24, COLORS.textDim).setDepth(10);
    const career = (f: Faction): void => {
      store.setFaction(f);
      this.go(SCENES.map, { faction: f });
    };
    const rebels = new Button(this, GAME_WIDTH - 355, 370, 'REBELS', () => career('rebel'), { width: 190, height: 84, size: 20, color: COLORS.gold });
    const imperials = new Button(this, GAME_WIDTH - 145, 370, 'EMPIRE', () => career('empire'), { width: 190, height: 84, size: 20, color: 0xff5a5a });
    const quick = new Button(this, GAME_WIDTH - 250, 470, 'QUICK MISSION', () => this.go(SCENES.briefing, QUICK_MISSION), { width: 400, height: 64, size: 18 });
    const hangar = new Button(this, GAME_WIDTH - 250, 548, 'HANGAR', () => this.go(SCENES.hangar), { width: 400, height: 64, size: 18 });
    for (const b of [rebels, imperials, quick, hangar]) b.setDepth(10);
    // Arrow keys: left/right between the two sides, down to the other buttons.
    this.nav = new MenuNav(this.input2, [rebels, imperials, quick, hangar], { start: empire ? 1 : 0 });

    // Parents (small, out of the way).
    const parents = this.add
      .text(GAME_WIDTH - 24, GAME_HEIGHT - 20, '⚙ Parents', { fontFamily: FONTS.round, fontStyle: '600', fontSize: '20px', color: COLORS.textDim })
      .setOrigin(1, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    parents.on('pointerover', () => parents.setColor('#ffffff'));
    parents.on('pointerout', () => parents.setColor(COLORS.textDim));
    parents.on('pointerdown', () => this.openParents());

    roundText(this, GAME_WIDTH / 2, GAME_HEIGHT - 34, 'Arrows / WASD to fly  •  SPACE to shoot  •  R to hear it again  •  P to pause', 20, COLORS.textDim).setDepth(10);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tweens.killAll());
  }

  private openParents(): void {
    if (this.panelOpen) return;
    this.panelOpen = true;
    this.input.keyboard?.resetKeys();
    this.input.keyboard?.disableGlobalCapture();
    if (this.input.keyboard) this.input.keyboard.enabled = false;
    openParentPanel(() => {
      this.panelOpen = false;
      this.input.keyboard?.enableGlobalCapture();
      if (this.input.keyboard) this.input.keyboard.enabled = true;
      this.input2.clear();
      // Rebuild to show updated name / stats.
      this.scene.restart();
    });
  }

  private go(key: string, data?: object): void {
    if (this.panelOpen) return;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }

  override update(_time: number, delta: number): void {
    this.t += delta / 1000;
    this.starfield.update(delta);
    this.ship.x = GAME_WIDTH / 2 + Math.sin(this.t * 0.8) * 60;
    this.ship.y = 460 + Math.sin(this.t * 1.3) * 14;
    this.ship.rotation = Math.cos(this.t * 0.8) * 0.12;
    this.enemies.forEach((e, i) => {
      const p = (this.t * 0.12 + i * 0.33) % 1;
      e.x = -150 + p * (GAME_WIDTH + 300);
      e.y = 260 + Math.sin(p * Math.PI * 2 + i) * 30;
      e.rotation = Math.sin(this.t * 2 + i) * 0.1;
    });
    if (this.panelOpen) return;
    this.input2.update();
    this.nav.update();
  }
}
