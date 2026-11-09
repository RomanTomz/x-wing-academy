import Phaser from 'phaser';
import { TEX } from '../art/textures';
import { THEME_TEX } from '../art/themes';
import { COLORS, GAME_WIDTH, SCENES } from '../core/constants';
import { audio, speech } from '../core/services';
import { InputController } from '../input/InputController';
import { TIE_ACADEMY, type Level, type MissionConfig } from '../progression/campaign';
import { createLevelPicker, type LevelPicker } from '../ui/LevelPicker';
import { Starfield } from '../ui/Starfield';
import { pixelText, roundText } from '../ui/widgets';

const IMPERIAL_RED = 0xff5a5a;

/** Fly for the other side: pick a level, then pilot a TIE fighter with different maths. */
export class TieAcademyScene extends Phaser.Scene {
  private starfield!: Starfield;
  private input2!: InputController;
  private picker!: LevelPicker;
  private tie!: Phaser.GameObjects.Image;
  private xwings: Phaser.GameObjects.Image[] = [];
  private t = 0;
  private leaving = false;

  constructor() {
    super(SCENES.tieAcademy);
  }

  create(): void {
    this.t = 0;
    this.leaving = false;
    this.xwings = [];
    this.starfield = new Starfield(this, { planet: false });
    this.input2 = new InputController(this);
    this.cameras.main.fadeIn(350, 0, 0, 0);
    audio.playMusic('menu', { transpose: -5, bpm: 90 });

    this.add.image(190, 250, THEME_TEX.planet('hull')).setScale(4).setAlpha(0.35);
    for (let i = 0; i < 3; i++) {
      this.xwings.push(this.add.image(-100, 0, TEX.ship('paint-red', 'x-wing')).setScale(0.9).setAngle(90).setAlpha(0.7));
    }
    const glow = this.add.image(190, 420, TEX.flare).setTint(0x7fe8ff).setAlpha(0.45).setScale(1.6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    this.tie = this.add.image(190, 400, TEX.tiePlayer).setScale(4.2);

    pixelText(this, GAME_WIDTH / 2, 44, 'TIE ACADEMY', 34, '#ff8a8a');
    roundText(this, 190, 560, 'Fly a TIE fighter!', 28, COLORS.text);
    roundText(this, 190, 610, TIE_ACADEMY.focus, 20, COLORS.textDim, { wordWrap: { width: 320 } });

    this.picker = createLevelPicker(this, this.input2, TIE_ACADEMY, {
      onPick: (level) => this.launch(level),
      onBack: () => this.leave(SCENES.menu),
      centerX: 790,
      overlay: false,
      accent: IMPERIAL_RED,
    });
    this.picker.container.setScale(0.92).setPosition(64, 40);
  }

  private launch(level: Level): void {
    const config: MissionConfig = { mode: 'campaign', planetId: TIE_ACADEMY.id, level };
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
    this.tie.y = 400 + Math.sin(this.t * 1.6) * 12;
    this.tie.rotation = Math.sin(this.t * 0.9) * 0.06;
    this.xwings.forEach((x, i) => {
      const p = (this.t * 0.15 + i * 0.33) % 1;
      x.x = -80 + p * 520;
      x.y = 130 + i * 70 + Math.sin(p * 6 + i) * 10;
    });
    this.input2.update();
    if (this.input2.consume('back')) {
      this.leave(SCENES.menu);
      return;
    }
    this.picker.nav.update();
  }
}
