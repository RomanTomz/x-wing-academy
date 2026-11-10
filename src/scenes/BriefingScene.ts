import Phaser from 'phaser';
import { PIXEL_SCALE, shipTexture, TEX } from '../art/textures';
import { COLORS, FONTS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, speech, store } from '../core/services';
import { InputController } from '../input/InputController';
import { Starfield } from '../ui/Starfield';
import { placeIcon } from '../art/themes';
import { isMissionConfig, LEVEL_NAMES, planetById, QUICK_MISSION, type MissionConfig } from '../progression/campaign';
import { Button, MenuNav, pixelText } from '../ui/widgets';

interface Briefing {
  title: string;
  text: (name: string) => string;
}

export const BRIEFINGS: readonly Briefing[] = [
  { title: 'Defend the Base', text: (n) => `Pilot ${n}! Enemy fighters are approaching the Rebel base. Find the correct targets and defend the fleet!` },
  { title: 'Nebula Hunt', text: (n) => `Welcome back, ${n}! Enemy fighters are hiding in the purple nebula. Solve the puzzles to find them!` },
  { title: 'Moon Patrol', text: (n) => `Red alert, ${n}! Enemy scouts are flying near the moon. Hit the right targets to keep our base secret!` },
  { title: 'Convoy Escort', text: (n) => `Pilot ${n}, our supply ships need an escort. Protect them from the enemy squadron!` },
  { title: 'Crystal Quest', text: (n) => `Great news, ${n}! We found energy crystals past the asteroid field. Clear the way and collect them!` },
];

/** Quick Missions when flying for the Empire. */
export const EMPIRE_BRIEFINGS: readonly Briefing[] = [
  { title: 'Rebel Patrol', text: (n) => `Pilot ${n}! Rebel X-wings are flying near the space station. Find the right targets and chase them away!` },
  { title: 'Asteroid Chase', text: (n) => `Good flying, ${n}! Rebels are hiding behind the asteroids. Solve the puzzles to find them!` },
  { title: 'Convoy Guard', text: (n) => `Pilot ${n}, guard our supply ships. Rebel fighters are on the way!` },
];

/** Animated mission introduction with a Mission Control transmission. */
export class BriefingScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private nav!: MenuNav;
  private body!: Phaser.GameObjects.Text;
  private fullText = '';
  private typed = 0;
  private typeTimer = 0;
  private launching = false;
  private cruiser!: Phaser.GameObjects.Image;
  private config: MissionConfig = QUICK_MISSION;

  constructor() {
    super(SCENES.briefing);
  }

  create(data?: unknown): void {
    this.config = isMissionConfig(data) ? data : QUICK_MISSION;
    this.launching = false;
    this.typed = 0;
    this.typeTimer = 0;
    const planet = this.config.mode === 'campaign' ? planetById(this.config.planetId) : undefined;
    this.starfield = new Starfield(this, { planet: !planet });
    if (planet) {
      const big = this.add.image(GAME_WIDTH - 230, 230, placeIcon(planet)).setScale(5).setDepth(0).setAlpha(0);
      this.tweens.add({ targets: big, alpha: 1, x: GAME_WIDTH - 260, duration: 2500, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: big, angle: 6, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    const quickList = store.faction === 'empire' ? EMPIRE_BRIEFINGS : BRIEFINGS;
    const briefing = quickList[store.data.profile.missionsCompleted % quickList.length];
    const level = this.config.mode === 'campaign' ? this.config.level : 1;
    this.fullText = planet ? planet.briefing(store.settings.pilotName, level) : briefing.text(store.settings.pilotName);
    const heading = planet ? planet.name : briefing.title;
    const subheading = planet ? `${LEVEL_NAMES[level].toUpperCase()} LEVEL • ${planet.levelInfo[level].toUpperCase()}` : `MISSION ${store.data.profile.missionsCompleted + 1}`;

    const empire = (planet?.faction ?? store.faction) === 'empire';
    // Fleet scene: your squadron (Rebel ships, or TIEs for the Empire) and the targets.
    this.cruiser = this.add.image(-300, 300, TEX.cruiser).setScale(PIXEL_SCALE).setDepth(2).setVisible(!empire);
    this.tweens.add({ targets: this.cruiser, x: 380, duration: 3000, ease: 'Cubic.easeOut' });
    for (let i = 0; i < 3; i++) {
      const s = empire
        ? this.add.image(-100 - i * 80, 200 + i * 70, shipTexture(store.loadout('empire'))).setScale(1.1).setDepth(3)
        : this.add.image(-100 - i * 80, 200 + i * 70, shipTexture(store.loadout('rebel'))).setScale(1.5).setAngle(90).setDepth(3);
      this.tweens.add({ targets: s, x: 700 + i * 50, duration: 3400 + i * 300, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: s, y: s.y + 10, duration: 1200 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    for (let i = 0; i < 4; i++) {
      const e = empire
        ? this.add.image(GAME_WIDTH + 80 + i * 40, 150 + i * 50, TEX.ship('paint-red', 'x-wing')).setScale(0.9).setAngle(-90).setAlpha(0).setDepth(1)
        : this.add.image(GAME_WIDTH + 80 + i * 40, 150 + i * 50, TEX.enemy).setScale(0.8).setAlpha(0).setDepth(1);
      this.tweens.add({ targets: e, x: GAME_WIDTH - 140 - i * 30, alpha: 0.85, duration: 2600, delay: 1200 + i * 200, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: e, y: e.y + 12, duration: 900 + i * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    pixelText(this, GAME_WIDTH / 2, 56, subheading, 20, COLORS.textDim).setDepth(5);
    pixelText(this, GAME_WIDTH / 2, 100, heading.toUpperCase(), 36, COLORS.textGold).setDepth(5);

    // Transmission panel.
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(COLORS.panel, 0.9);
    g.fillRoundedRect(140, 430, 1000, 170, 18);
    g.lineStyle(3, COLORS.hud, 1);
    g.strokeRoundedRect(140, 430, 1000, 170, 18);
    const helmet = this.add.image(220, 515, empire ? TEX.helmetImperial : TEX.helmet).setScale(4.5).setDepth(11);
    this.tweens.add({ targets: helmet, alpha: { from: 1, to: 0.75 }, duration: 120, yoyo: true, repeat: -1, repeatDelay: 900 });
    this.add.text(290, 446, 'INCOMING TRANSMISSION • MISSION CONTROL', { fontFamily: FONTS.pixel, fontSize: '12px', color: COLORS.textDim }).setDepth(11);
    this.body = this.add
      .text(290, 472, '', { fontFamily: FONTS.round, fontStyle: '600', fontSize: '32px', color: COLORS.text, wordWrap: { width: 820 }, lineSpacing: 4 })
      .setDepth(11);

    const launch = new Button(this, GAME_WIDTH / 2, 660, 'LAUNCH!', () => this.launch(), { width: 340, height: 80, size: 28, color: COLORS.gold });
    launch.setDepth(12);
    this.tweens.add({ targets: launch, scale: 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nav = new MenuNav(this.input2, [launch]);

    audio.play('beep');
    this.time.delayedCall(400, () => speech.speak(this.fullText));
  }

  private launch(): void {
    if (this.launching) return;
    if (this.typed < this.fullText.length) {
      // First press finishes the text, second press launches.
      this.typed = this.fullText.length;
      this.body.setText(this.fullText);
      return;
    }
    this.launching = true;
    speech.cancel();
    audio.play('whoosh');
    this.tweens.add({ targets: this.starfield, speed: 14, duration: 700, ease: 'Quad.easeIn' });
    this.cameras.main.fadeOut(700, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SCENES.mission, this.config));
  }

  override update(_time: number, delta: number): void {
    this.starfield.update(delta);
    if (this.typed < this.fullText.length) {
      this.typeTimer += delta;
      while (this.typeTimer > 28 && this.typed < this.fullText.length) {
        this.typeTimer -= 28;
        this.typed++;
        if (this.typed % 3 === 0) audio.play('tick');
      }
      this.body.setText(this.fullText.slice(0, this.typed));
    }
    this.input2.update();
    if (this.input2.consume('back')) {
      speech.cancel();
      if (this.config.mode === 'quick') this.scene.start(SCENES.menu);
      else this.scene.start(SCENES.map, { faction: planetById(this.config.planetId)?.faction ?? store.faction });
      return;
    }
    this.nav.update();
  }
}
