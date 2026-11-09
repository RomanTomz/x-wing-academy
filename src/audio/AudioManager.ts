/**
 * All sound is synthesised with the Web Audio API — no recordings, nothing to
 * license. Every public method is safe to call when audio is unavailable or
 * still locked by the browser's autoplay policy.
 */
export type SfxName =
  | 'laser'
  | 'shield'
  | 'explosion'
  | 'correct'
  | 'crystal'
  | 'asteroid'
  | 'bump'
  | 'click'
  | 'select'
  | 'whoosh'
  | 'fanfare'
  | 'unlock'
  | 'beep'
  | 'tick'
  | 'levelup';

export type MusicTrack = 'menu' | 'mission' | 'none';

interface Voice {
  type: OscillatorType;
  freq: number;
  start: number;
  dur: number;
  gain: number;
  slideTo?: number;
  dest?: AudioNode;
}

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private volumes = { music: 0.5, sfx: 0.8, muted: false };
  private track: MusicTrack = 'none';
  private wantedTrack: MusicTrack = 'none';
  private musicOpts = { transpose: 0, bpm: 0 };
  private wantedOpts = { transpose: 0, bpm: 0 };
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private crystalCombo = 0;
  private lastLaser = 0;
  private ducked = false;

  get available(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (click / key press). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.build(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
      if (this.wantedTrack !== this.track) this.playMusic(this.wantedTrack, this.wantedOpts);
    } catch {
      this.ctx = null;
    }
  }

  private build(ctx: AudioContext): void {
    this.master = ctx.createGain();
    // Gentle limiter so nothing is ever startling.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.sfxGain = ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Continuous engine rumble (filtered noise).
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 180;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    src.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    src.start();
    this.applyVolumes();
  }

  setVolumes(music: number, sfx: number, muted: boolean): void {
    this.volumes = { music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : 0.55, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.volumes.music * 0.32 * (this.ducked ? 0.4 : 1), t, 0.1);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx * 0.6, t, 0.05);
  }

  /** Lower the music (e.g. while paused or while speech plays). */
  duck(on: boolean): void {
    this.ducked = on;
    this.applyVolumes();
  }

  /** 0 = idle hum, 1 = full thrust. */
  setEngine(level: number): void {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(level < 0 ? 0 : 0.12 + level * 0.12, t, 0.15);
    this.engineFilter.frequency.setTargetAtTime(160 + level * 260, t, 0.15);
  }

  private tone(v: Voice): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = v.type;
    osc.frequency.setValueAtTime(v.freq, v.start);
    if (v.slideTo) osc.frequency.exponentialRampToValueAtTime(v.slideTo, v.start + v.dur);
    g.gain.setValueAtTime(0.0001, v.start);
    g.gain.exponentialRampToValueAtTime(v.gain, v.start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, v.start + v.dur);
    osc.connect(g);
    g.connect(v.dest ?? this.sfxGain);
    osc.start(v.start);
    osc.stop(v.start + v.dur + 0.05);
  }

  private noiseBurst(start: number, dur: number, gain: number, freq: number, type: BiquadFilterType = 'lowpass', endFreq?: number): void {
    if (!this.ctx || !this.sfxGain || !this.noise) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      this.playUnsafe(name, this.ctx.currentTime);
    } catch {
      /* never let audio break the game */
    }
  }

  private playUnsafe(name: SfxName, t: number): void {
    switch (name) {
      case 'laser': {
        if (t - this.lastLaser < 0.05) return;
        this.lastLaser = t;
        const f = 1300 + Math.random() * 200;
        this.tone({ type: 'square', freq: f, slideTo: 180, start: t, dur: 0.16, gain: 0.07 });
        this.tone({ type: 'sawtooth', freq: f * 0.5, slideTo: 120, start: t, dur: 0.12, gain: 0.04 });
        break;
      }
      case 'shield':
        this.tone({ type: 'sine', freq: 520, slideTo: 380, start: t, dur: 0.35, gain: 0.16 });
        this.tone({ type: 'triangle', freq: 780, slideTo: 600, start: t + 0.02, dur: 0.3, gain: 0.08 });
        this.noiseBurst(t, 0.15, 0.12, 2400, 'bandpass');
        break;
      case 'explosion':
        this.noiseBurst(t, 0.9, 0.5, 1800, 'lowpass', 90);
        this.tone({ type: 'sine', freq: 140, slideTo: 40, start: t, dur: 0.6, gain: 0.35 });
        break;
      case 'asteroid':
        this.noiseBurst(t, 0.35, 0.3, 1200, 'lowpass', 120);
        break;
      case 'bump':
        this.tone({ type: 'sine', freq: 200, slideTo: 90, start: t, dur: 0.25, gain: 0.2 });
        this.noiseBurst(t, 0.12, 0.08, 3000, 'bandpass');
        break;
      case 'correct': {
        const notes = [72, 76, 79, 84];
        notes.forEach((n, i) => {
          this.tone({ type: 'triangle', freq: NOTE(n), start: t + 0.18 + i * 0.075, dur: 0.3, gain: 0.16 });
          this.tone({ type: 'sine', freq: NOTE(n + 12), start: t + 0.18 + i * 0.075, dur: 0.2, gain: 0.05 });
        });
        break;
      }
      case 'crystal': {
        const n = 84 + Math.min(12, this.crystalCombo++ * 2);
        this.tone({ type: 'sine', freq: NOTE(n), start: t, dur: 0.25, gain: 0.14 });
        this.tone({ type: 'triangle', freq: NOTE(n + 7), start: t + 0.05, dur: 0.25, gain: 0.07 });
        break;
      }
      case 'click':
        this.tone({ type: 'square', freq: 880, start: t, dur: 0.05, gain: 0.05 });
        break;
      case 'select':
        this.tone({ type: 'triangle', freq: NOTE(76), start: t, dur: 0.1, gain: 0.12 });
        this.tone({ type: 'triangle', freq: NOTE(83), start: t + 0.06, dur: 0.14, gain: 0.12 });
        break;
      case 'whoosh':
        this.noiseBurst(t, 0.9, 0.22, 300, 'bandpass', 3000);
        break;
      case 'beep': {
        const base = 70 + Math.floor(Math.random() * 10);
        [0, 0.09, 0.16].forEach((d, i) => {
          this.tone({ type: 'square', freq: NOTE(base + [0, 7, 4][i] + 12), start: t + d, dur: 0.07, gain: 0.04 });
        });
        break;
      }
      case 'tick':
        this.tone({ type: 'square', freq: 1400, start: t, dur: 0.03, gain: 0.03 });
        break;
      case 'levelup':
        [67, 72, 76, 79, 84].forEach((n, i) => this.tone({ type: 'triangle', freq: NOTE(n), start: t + i * 0.06, dur: 0.25, gain: 0.12 }));
        break;
      case 'unlock':
        [79, 83, 86, 91].forEach((n, i) => {
          this.tone({ type: 'sine', freq: NOTE(n), start: t + i * 0.1, dur: 0.5, gain: 0.12 });
          this.tone({ type: 'triangle', freq: NOTE(n - 12), start: t + i * 0.1, dur: 0.4, gain: 0.06 });
        });
        break;
      case 'fanfare': {
        // Original heroic fanfare in C major.
        const seq: [number, number, number][] = [
          [67, 0, 0.18], [67, 0.2, 0.12], [67, 0.34, 0.12], [72, 0.5, 0.5],
          [79, 1.05, 0.35], [77, 1.42, 0.14], [76, 1.58, 0.14], [74, 1.74, 0.14], [84, 1.92, 0.7],
        ];
        for (const [n, d, len] of seq) {
          this.tone({ type: 'sawtooth', freq: NOTE(n), start: t + d, dur: len + 0.15, gain: 0.07 });
          this.tone({ type: 'triangle', freq: NOTE(n), start: t + d, dur: len + 0.2, gain: 0.12 });
        }
        [48, 55, 60].forEach((n) => this.tone({ type: 'triangle', freq: NOTE(n), start: t + 1.92, dur: 1.2, gain: 0.1 }));
        break;
      }
    }
  }

  resetCrystalCombo(): void {
    this.crystalCombo = 0;
  }

  // ---------------------------------------------------------------- Music

  /** Start a looping track. `transpose` (semitones) and `bpm` give each planet its own flavour. */
  playMusic(track: MusicTrack, opts: { transpose?: number; bpm?: number } = {}): void {
    const o = { transpose: opts.transpose ?? 0, bpm: opts.bpm ?? 0 };
    this.wantedTrack = track;
    this.wantedOpts = o;
    if (!this.ctx || this.ctx.state === 'closed') return;
    const same = o.transpose === this.musicOpts.transpose && o.bpm === this.musicOpts.bpm;
    if (track === this.track && same && this.schedulerId !== null) return;
    this.stopScheduler();
    this.track = track;
    this.musicOpts = o;
    if (track === 'none') return;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.schedulerId = window.setInterval(() => this.schedule(), 50);
  }

  private stopScheduler(): void {
    if (this.schedulerId !== null) window.clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || ctx.state !== 'running') return;
    const bpm = this.musicOpts.bpm || (this.track === 'menu' ? 96 : 112);
    const sixteenth = 60 / bpm / 4;
    // Avoid a burst of catch-up notes after the tab was hidden.
    if (this.nextNoteTime < ctx.currentTime - 0.2) this.nextNoteTime = ctx.currentTime + 0.05;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      this.playStep(this.step, this.nextNoteTime, sixteenth);
      this.nextNoteTime += sixteenth;
      this.step = (this.step + 1) % 128;
    }
  }

  /** An original looping piece: i–VI–III–VII in D minor with a bouncy arpeggio. */
  private playStep(step: number, t: number, len: number): void {
    const dest = this.musicGain;
    if (!dest) return;
    const bar = Math.floor(step / 16) % 8;
    const inBar = step % 16;
    const roots = [50, 46, 53, 48, 50, 46, 53, 52]; // D, Bb, F, C, D, Bb, F, E
    const chords: number[][] = [
      [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 6],
    ];
    const root = roots[bar] + this.musicOpts.transpose;
    const chord = chords[bar];

    // Bass: driving eighths in the mission, half notes in the menu.
    const bassEvery = this.track === 'mission' ? 2 : 8;
    if (inBar % bassEvery === 0) {
      this.tone({ type: 'triangle', freq: NOTE(root - 12), start: t, dur: len * bassEvery * 0.9, gain: 0.5, dest });
    }
    // Arpeggio.
    if (inBar % 2 === 0) {
      const idx = (inBar / 2) % 4;
      const n = root + 12 + chord[[0, 1, 2, 1][idx]] + (idx === 2 ? 12 : 0);
      this.tone({ type: 'square', freq: NOTE(n), start: t, dur: len * 1.6, gain: 0.07, dest });
    }
    // Soft pad at the start of each bar.
    if (inBar === 0) {
      for (const iv of chord) this.tone({ type: 'sine', freq: NOTE(root + 12 + iv), start: t, dur: len * 15, gain: 0.08, dest });
    }
    // Menu melody (original).
    if (this.track === 'menu') {
      const melody: (number | null)[] = [
        74, null, null, null, 77, null, 76, null, 74, null, null, null, 69, null, null, null,
        70, null, null, null, 74, null, 72, null, 70, null, 69, null, 67, null, null, null,
        72, null, null, null, 77, null, 76, null, 77, null, 79, null, 81, null, null, null,
        79, null, null, null, 77, null, 76, null, 72, null, null, null, 76, null, null, null,
      ];
      const m = melody[step % 64];
      const n = m === null ? null : m + this.musicOpts.transpose;
      if (n !== null && bar >= 4) this.tone({ type: 'triangle', freq: NOTE(n), start: t, dur: len * 3.5, gain: 0.2, dest });
    }
    // Light hi-hat in the mission.
    if (this.track === 'mission' && inBar % 4 === 2 && this.noise && this.ctx) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t, Math.random());
      src.stop(t + 0.08);
    }
  }
}
