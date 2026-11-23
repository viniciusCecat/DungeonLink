class RetroSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, endFreq: number, duration: number, type: OscillatorType = 'square', gainVal = 0.08): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  slash(): void {
    this.playTone(480, 160, 0.09, 'sawtooth', 0.07);
  }

  hitEnemy(): void {
    this.playTone(240, 520, 0.08, 'square', 0.08);
  }

  hurtPlayer(): void {
    this.playTone(170, 75, 0.16, 'sawtooth', 0.09);
  }

  doorEnter(): void {
    this.playTone(330, 660, 0.14, 'triangle', 0.08);
  }

  portalUnlock(): void {
    this.playTone(440, 880, 0.22, 'sine', 0.09);
    setTimeout(() => this.playTone(660, 1180, 0.24, 'triangle', 0.08), 110);
  }

  victory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n, 0.16, 'square', 0.07), idx * 105);
    });
  }

  dungeonLoaded(): void {
    this.playTone(392, 587, 0.12, 'triangle', 0.07);
  }
}

export const soundEngine = new RetroSoundEngine();
