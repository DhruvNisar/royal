/**
 * Synthesized Web Audio API Casino Sound Engine for ROYAL ACE
 * Zero external asset dependencies - 100% reliable, zero broken sound URLs.
 */

import { SoundSettings } from '../types';

class CasinoSoundEngine {
  private ctx: AudioContext | null = null;
  private settings: SoundSettings = {
    masterVolume: 0.75,
    sfxEnabled: true,
    musicEnabled: false,
  };
  private ambientInterval: number | null = null;
  private isUnlocked: boolean = false;

  constructor() {
    // Lazy audio context initialization on first user interaction
    const unlockAudio = () => {
      this.initContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', unlockAudio);
      window.addEventListener('touchstart', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
    }
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.isUnlocked = true;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public updateSettings(newSettings: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (this.settings.musicEnabled) {
      this.startAmbientMusic();
    } else {
      this.stopAmbientMusic();
    }
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  // --- Core Tone Generator Helpers ---
  private createGain(peakGain: number = 0.5): GainNode | null {
    if (!this.ctx || !this.settings.sfxEnabled) return null;
    const gain = this.ctx.createGain();
    const vol = peakGain * this.settings.masterVolume;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.connect(this.ctx.destination);
    return gain;
  }

  // Subtle button click
  public playButtonClick() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.08 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Realistic Casino Chip Clink / Strike
  public playChipClick() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    // Characteristic ceramic chip frequencies with slight pitch variations
    const variance = (Math.random() - 0.5) * 80;
    osc1.frequency.setValueAtTime(2200 + variance, now);
    osc1.frequency.exponentialRampToValueAtTime(1400, now + 0.06);

    osc2.frequency.setValueAtTime(3600 + variance, now);
    osc2.frequency.exponentialRampToValueAtTime(2000, now + 0.05);

    gain.gain.setValueAtTime(0.2 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.08);
    osc2.stop(now + 0.08);
  }

  // Multiple chips stacking
  public playChipStack() {
    this.playChipClick();
    setTimeout(() => this.playChipClick(), 50);
  }

  // Card Deal / Flip Crisp Sound
  public playCardDeal() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.06;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  public playCardFlip() {
    this.playCardDeal();
  }

  // Dice Rolling Rattle & Clatter
  public playDiceRoll() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600 + Math.random() * 400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);

        gain.gain.setValueAtTime(0.12 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      }, i * 65);
    }
  }

  // Roulette Ball Tick on Wheel Deflectors
  public playRouletteTick(pitchMultiplier = 1) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800 * pitchMultiplier, now);
    osc.frequency.exponentialRampToValueAtTime(900 * pitchMultiplier, now + 0.025);

    gain.gain.setValueAtTime(0.09 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Slots Reel Tick
  public playReelTick() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.02);

    gain.gain.setValueAtTime(0.05 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  // Slots Reel Stop Clunk
  public playReelStop() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

    gain.gain.setValueAtTime(0.16 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Win Musical Arpeggio
  public playWin() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.15 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      }, idx * 75);
    });
  }

  // Big Win / Jackpot Royal Flourish
  public playBigWin() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const fanfares = [
      { note: 440, delay: 0 },    // A4
      { note: 554.37, delay: 100 }, // C#5
      { note: 659.25, delay: 200 }, // E5
      { note: 880, delay: 300 },    // A5
      { note: 783.99, delay: 450 }, // G5
      { note: 880, delay: 600 },    // A5
      { note: 1108.73, delay: 800 }, // C#6
    ];

    fanfares.forEach(({ note, delay }) => {
      setTimeout(() => {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note, now);

        gain.gain.setValueAtTime(0.2 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);
      }, delay);
    });
  }

  // Soft Loss feedback
  public playLoss() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);

    gain.gain.setValueAtTime(0.12 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Lounge Ambient Chord Drone
  private startAmbientMusic() {
    if (this.ambientInterval) return;
    this.initContext();

    const chords = [
      [220, 277.18, 329.63], // A major pad
      [196, 246.94, 293.66], // G major pad
      [174.61, 220, 261.63], // F major pad
      [196, 246.94, 293.66], // G major pad
    ];

    let chordIdx = 0;
    const playNextChord = () => {
      if (!this.ctx || !this.settings.musicEnabled) return;
      const now = this.ctx.currentTime;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;

      chord.forEach(freq => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Very quiet warm lounge ambiance
        const targetGain = 0.02 * this.settings.masterVolume;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 1.5);
        gain.gain.linearRampToValueAtTime(0.001, now + 4.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 5.0);
      });
    };

    playNextChord();
    this.ambientInterval = window.setInterval(playNextChord, 5000);
  }

  private stopAmbientMusic() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}

export const soundManager = new CasinoSoundEngine();
