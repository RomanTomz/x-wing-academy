import { AudioManager } from '../audio/AudioManager';
import { Speech } from '../audio/Speech';
import { browserStorage, GameStore } from '../persistence/gameStore';

/** Game-wide singletons shared by all scenes. */
export const store = new GameStore(browserStorage());
export const audio = new AudioManager();
export const speech = new Speech();

export function applyAudioSettings(): void {
  const s = store.settings;
  audio.setVolumes(s.musicVolume, s.sfxVolume, s.muted);
  speech.enabled = s.speech && !s.muted;
}
applyAudioSettings();
