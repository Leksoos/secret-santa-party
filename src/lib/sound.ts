/**
 * Web Audio Synthesizer for Jackbox & Festive Holiday Sounds
 * Zero external audio dependencies required - generates rich sound effects dynamically!
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Play a sound by name
  public play(name: string) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      switch (name) {
        case 'chime':
          this.playChime();
          break;
        case 'bells':
          this.playBells();
          break;
        case 'roulette':
          this.playRouletteTick();
          break;
        case 'mystery':
        case 'suspense':
          this.playMysteryChord();
          break;
        case 'countdown':
          this.playTickTock();
          break;
        case 'camera':
          this.playCameraShutter();
          break;
        case 'fanfare':
          this.playGrandFanfare();
          break;
        case 'applause':
        case 'celebration':
          this.playCheer();
          break;
        case 'pop':
          this.playPop();
          break;
        case 'laugh':
          this.playLaughTone();
          break;
        case 'shock':
          this.playShockSynth();
          break;
        case 'cricket':
          this.playCrickets();
          break;
        default:
          this.playPop();
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Bright harmonic bell chime for instantaneous check-in feedback (C6, E6, G6, C7 with 0.35s decay)
  public playChime() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [1046.5, 1318.51, 1567.98, 2093.0]; // C6, E6, G6, C7
    const times = [0, 0.08, 0.16, 0.24];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + times[i]);

      gain.gain.setValueAtTime(0.2, now + times[i]);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + times[i] + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + times[i]);
      osc.stop(now + times[i] + 0.36);
    });
  }

  // Jingle Bells harmonic sequence
  private playBells() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [659.25, 659.25, 659.25, 659.25, 659.25, 659.25, 659.25, 783.99, 523.25, 587.33, 659.25];
    const times = [0, 0.18, 0.36, 0.72, 0.9, 1.08, 1.44, 1.62, 1.8, 1.98, 2.16];

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + times[i]);

      gain.gain.setValueAtTime(0.15, now + times[i]);
      gain.gain.exponentialRampToValueAtTime(0.001, now + times[i] + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + times[i]);
      osc.stop(now + times[i] + 0.4);
    });
  }

  // Roulette ticking sound
  private playRouletteTick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 12; i++) {
      const t = now + i * 0.08 + (i * i * 0.006);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300 + i * 20, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  // Mystery / detective suspense chords
  private playMysteryChord() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [220, 261.63, 311.13, 440]; // Diminished / mysterious

    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 1.8);
    });
  }

  // Camera shutter sound
  private playCameraShutter() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Quick double click
    [0, 0.1].forEach((delay) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now + delay);
      osc.frequency.exponentialRampToValueAtTime(120, now + delay + 0.04);

      gain.gain.setValueAtTime(0.1, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.06);
    });
  }

  // Grand fanfare for reveal
  private playGrandFanfare() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0, d: 0.15 },    // C5
      { f: 659.25, t: 0.15, d: 0.15 }, // E5
      { f: 783.99, t: 0.3, d: 0.15 },  // G5
      { f: 1046.5, t: 0.45, d: 0.9 },  // C6 (Triumphant hold)
    ];

    notes.forEach(({ f, t, d }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.2, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

  // Ticking clock
  private playTickTock() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Cheering & applause synth noise
  private playCheer() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 600, now + i * 0.12);

      gain.gain.setValueAtTime(0.08, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.35);
    }
  }

  // Bubble pop
  private playPop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Laughing comedic wah-wah
  private playLaughTone() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [440, 415, 392, 349];
    notes.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.15);
      gain.gain.setValueAtTime(0.08, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.22);
    });
  }

  // Shock screech / buzzer
  private playShockSynth() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Awkward cricket chirps
  private playCrickets() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.08, 0.16, 0.4, 0.48, 0.56].forEach((t) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4500, now + t);
      gain.gain.setValueAtTime(0.04, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.05);
    });
  }
}

export const sound = new SoundEngine();
