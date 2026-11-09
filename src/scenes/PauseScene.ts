import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../core/constants';
import { applyAudioSettings, audio, store } from '../core/services';
import { InputController } from '../input/InputController';
import { Button, MenuNav, panel, pixelText, roundText } from '../ui/widgets';

/** Overlay shown on P / Esc, or automatically when the window loses focus. */
export class PauseScene extends Phaser.Scene {
  private nav!: MenuNav;
  private input2!: InputController;
  private muteButton!: Button;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    this.input2 = new InputController(this);
    audio.duck(true);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000814, 0.7).setOrigin(0);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 470, COLORS.hud, 0.92);
    pixelText(this, GAME_WIDTH / 2, 190, 'PAUSED', 40, COLORS.textGold);
    roundText(this, GAME_WIDTH / 2, 245, 'Take a break, pilot!', 28, COLORS.textDim);

    const resume = new Button(this, GAME_WIDTH / 2, 330, 'RESUME', () => this.resume());
    this.muteButton = new Button(this, GAME_WIDTH / 2, 420, this.muteLabel(), () => this.toggleMute());
    const home = new Button(this, GAME_WIDTH / 2, 510, 'HOME BASE', () => this.home());
    this.nav = new MenuNav(this.input2, [resume, this.muteButton, home]);
  }

  private muteLabel(): string {
    return store.settings.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  private toggleMute(): void {
    store.updateSettings({ muted: !store.settings.muted });
    applyAudioSettings();
    this.muteButton.label.setText(this.muteLabel());
  }

  private resume(): void {
    audio.duck(false);
    this.scene.resume(SCENES.mission);
    this.scene.stop();
  }

  private home(): void {
    audio.duck(false);
    this.scene.stop(SCENES.mission);
    this.scene.start(SCENES.menu);
  }

  override update(): void {
    this.input2.update();
    if (this.input2.consume('pause')) {
      this.resume();
      return;
    }
    this.nav.update();
  }
}
