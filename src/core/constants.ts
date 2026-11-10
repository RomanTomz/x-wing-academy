export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** The ship must stay in the bottom 60% of the screen. */
export const PLAYER_MIN_Y = Math.round(GAME_HEIGHT * 0.4) + 50;
export const PLAYER_MAX_Y = GAME_HEIGHT - 60;

export const FONTS = {
  pixel: '"Press Start 2P", monospace',
  round: 'Fredoka, "Trebuchet MS", sans-serif',
} as const;

export const COLORS = {
  hud: 0x7fe8ff,
  hudDim: 0x2a6f86,
  panel: 0x081428,
  gold: 0xffd23f,
  good: 0x5dff9a,
  hint: 0xffe27a,
  white: 0xffffff,
  text: '#eaf8ff',
  textDim: '#8fb8cc',
  textGold: '#ffd23f',
  textHint: '#ffe27a',
  stroke: '#04101f',
} as const;

export const SCENES = {
  boot: 'Boot',
  menu: 'Menu',
  map: 'GalaxyMap',
  briefing: 'Briefing',
  mission: 'Mission',
  pause: 'Pause',
  complete: 'Complete',
  hangar: 'Hangar',
} as const;
