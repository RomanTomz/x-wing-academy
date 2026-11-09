import '@fontsource/press-start-2p/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './core/constants';
import { audio } from './core/services';
import { BootScene } from './scenes/BootScene';
import { BriefingScene } from './scenes/BriefingScene';
import { CompleteScene } from './scenes/CompleteScene';
import { GalaxyMapScene } from './scenes/GalaxyMapScene';
import { HangarScene } from './scenes/HangarScene';
import { MenuScene } from './scenes/MenuScene';
import { MissionScene } from './scenes/MissionScene';
import { PauseScene } from './scenes/PauseScene';
import { TieAcademyScene } from './scenes/TieAcademyScene';

// Browsers only allow audio after a user gesture.
const unlockAudio = (): void => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

async function loadFonts(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('16px "Press Start 2P"'),
        document.fonts.load('600 32px Fredoka'),
        document.fonts.load('700 32px Fredoka'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

async function start(): Promise<void> {
  await loadFonts();
  document.getElementById('loading')?.remove();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#03040c',
    pixelArt: true,
    roundPixels: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { gamepad: true, activePointers: 2 },
    fps: { target: 60 },
    audio: { noAudio: true },
    scene: [BootScene, MenuScene, GalaxyMapScene, TieAcademyScene, BriefingScene, MissionScene, PauseScene, CompleteScene, HangarScene],
  });
  // Handy for debugging in the console.
  (window as unknown as { game: Phaser.Game }).game = game;
}

void start();
