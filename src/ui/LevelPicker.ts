import Phaser from 'phaser';
import { THEME_TEX } from '../art/themes';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { speech, store } from '../core/services';
import type { InputController } from '../input/InputController';
import { LEVEL_NAMES, LEVELS, type Level, type Planet } from '../progression/campaign';
import { Button, MenuNav, panel, pixelText, roundText } from './widgets';

export interface LevelPicker {
  container: Phaser.GameObjects.Container;
  nav: MenuNav;
}

/**
 * Cadet / Pilot / Ace chooser for a planet (or the TIE Academy), showing the
 * star earned on each level. Respects a parent's level lock.
 */
export function createLevelPicker(
  scene: Phaser.Scene,
  input: InputController,
  planet: Planet,
  opts: { onPick: (level: Level) => void; onBack: () => void; centerX?: number; overlay?: boolean; accent?: number },
): LevelPicker {
  const cx = opts.centerX ?? GAME_WIDTH / 2;
  const accent = opts.accent ?? COLORS.hud;
  const c = scene.add.container(0, 0).setDepth(50);
  if (opts.overlay !== false) {
    c.add(scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000814, 0.75).setOrigin(0).setInteractive());
  }
  c.add(panel(scene, cx, 370, 780, 560, accent, 0.95));
  c.add(scene.add.image(cx - 300, 160, THEME_TEX.planet(planet.theme)).setScale(1.3));
  c.add(pixelText(scene, cx + 40, 140, planet.name.toUpperCase(), 28, COLORS.textGold));
  c.add(roundText(scene, cx + 40, 186, 'Choose your level', 26, COLORS.textDim));

  const settings = store.settings;
  const cleared = store.data.profile.campaign[planet.id].cleared;
  const buttons: Button[] = [];
  LEVELS.forEach((lvl, k) => {
    const y = 270 + k * 100;
    const b = new Button(scene, cx - 170, y, LEVEL_NAMES[lvl].toUpperCase(), () => opts.onPick(lvl), {
      width: 260,
      height: 78,
      size: 22,
      color: lvl === 1 ? 0x5dff9a : lvl === 2 ? COLORS.hud : COLORS.gold,
    });
    const desc = roundText(scene, cx + 20, y, planet.levelInfo[lvl], 26, COLORS.text).setOrigin(0, 0.5);
    const star = scene.add.image(cx + 320, y, THEME_TEX.star).setScale(2.4).setTint(cleared[lvl - 1] ? 0xffffff : 0x343a50);
    if (!settings.adaptive && settings.tier !== lvl) {
      b.setDisabled(true);
      desc.setAlpha(0.4);
      star.setAlpha(0.4);
    }
    c.add([b, desc, star]);
    buttons.push(b);
  });
  if (!settings.adaptive) c.add(roundText(scene, cx, 560, 'A grown-up has chosen your level.', 22, COLORS.textDim));
  const back = new Button(scene, cx, 610, 'BACK', opts.onBack, { width: 220, height: 60, size: 16 });
  c.add(back);

  // Focus the first level not yet cleared (and allowed).
  const allowed = LEVELS.filter((l) => settings.adaptive || settings.tier === l);
  const start = allowed.find((l) => !cleared[l - 1]) ?? allowed[0];
  const nav = new MenuNav(input, [...buttons, back], { start: start - 1 });
  input.clear();
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 180 });
  speech.speak(`${planet.name}. Choose Cadet, Pilot or Ace.`);
  return { container: c, nav };
}
