/** Optional spoken prompts. Never throws and never blocks gameplay. */
export class Speech {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;

  get supported(): boolean {
    return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
  }

  constructor() {
    if (!this.supported) return;
    const choose = (): void => {
      try {
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang === 'en-GB' && /female|serena|kate|martha|libby|sonia/i.test(v.name)) ??
          voices.find((v) => v.lang === 'en-GB') ??
          voices.find((v) => v.lang.startsWith('en')) ??
          null;
      } catch {
        this.voice = null;
      }
    };
    choose();
    try {
      speechSynthesis.addEventListener('voiceschanged', choose);
    } catch {
      /* older browsers */
    }
  }

  speak(text: string, opts: { interrupt?: boolean } = {}): void {
    if (!this.enabled || !this.supported || text.trim() === '') return;
    try {
      if (opts.interrupt !== false) speechSynthesis.cancel();
      const spoken = text
        .replace(/−/g, ' minus ')
        .replace(/×/g, ' times ')
        .replace(/÷/g, ' divided by ')
        .replace(/</g, ' less than ')
        .replace(/>/g, ' greater than ')
        .replace(/½/g, ' a half ')
        .replace(/¼/g, ' a quarter ')
        .replace(/¾/g, ' three quarters ')
        .replace(/⅓/g, ' a third ');
      const u = new SpeechSynthesisUtterance(spoken);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? 'en-GB';
      u.rate = 0.92;
      u.pitch = 1.05;
      u.volume = 1;
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  cancel(): void {
    if (!this.supported) return;
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
