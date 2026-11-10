import Phaser from 'phaser';
import { generateTextures } from '../art/textures';
import { generateThemeTextures } from '../art/themes';
import { generateBossTextures } from '../art/bosses';
import { generateJunkTextures } from '../art/junk';
import { SCENES } from '../core/constants';

/** Builds all procedural art, then opens the main menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    generateTextures(this);
    generateThemeTextures(this);
    generateBossTextures(this);
    generateJunkTextures(this);
    this.scene.start(SCENES.menu);
  }
}
