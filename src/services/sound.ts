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

  // --- Plinko Synthesized SFX ---
  public playPlinkoDrop() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);

    gain.gain.setValueAtTime(0.11 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playPlinkoBounce(rowIndex: number = 0, totalRows: number = 12) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const ratio = totalRows > 0 ? rowIndex / totalRows : 0.5;
    const baseFreq = 980 + ratio * 680;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, now + 0.035);

    gain.gain.setValueAtTime(0.075 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playPlinkoLand(isProfit: boolean) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isProfit ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isProfit ? 740 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(isProfit ? 1120 : 190, now + 0.12);

    gain.gain.setValueAtTime((isProfit ? 0.16 : 0.1) * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // --- Crash Synthesized SFX ---
  public playCrashLaunch() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);

    gain.gain.setValueAtTime(0.11 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCrashTick(multiplier: number) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freq = Math.min(1800, 420 + Math.log2(Math.max(1, multiplier)) * 180);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.035 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playCrashCashOut() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const notes = [659.25, 880, 1174.66];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.settings.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.15 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      }, idx * 55);
    });
  }

  public playCrashExplosion() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;

    // Low boom oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.38);

    oscGain.gain.setValueAtTime(0.22 * this.settings.masterVolume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);

    // Filtered noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18 * this.settings.masterVolume, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // --- Royal Mines Synthesized SFX ---
  public playMinesTileClick() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.035);

    gain.gain.setValueAtTime(0.07 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playMinesDiamond(revealCount: number = 1) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const semitoneBoost = Math.min(14, Math.max(0, revealCount - 1));
    const baseFreq = 660 * Math.pow(2, semitoneBoost / 12);

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.12);

    osc2.frequency.setValueAtTime(baseFreq * 1.5, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.16);

    gain.gain.setValueAtTime(0.14 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.02);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }

  public playMinesExplosion() {
    this.playCrashExplosion();
  }

  public playMinesCashOut() {
    this.playCrashCashOut();
  }

  // --- Royal Keno Synthesized SFX ---
  public playKenoNumberToggle(isSelected: boolean) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isSelected ? 620 : 440;
    const endFreq = isSelected ? 880 : 330;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.04);

    gain.gain.setValueAtTime(0.08 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playKenoQuickPick() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.settings.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.05);

        gain.gain.setValueAtTime(0.09 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      }, idx * 40);
    });
  }

  public playKenoBallDraw(ballIndex: number = 0) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Subtle pitch progression through the 20 balls (400Hz up to 700Hz)
    const baseFreq = 420 + Math.min(20, ballIndex) * 14;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.75, now + 0.035);

    gain.gain.setValueAtTime(0.06 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playKenoMatchHit(matchCount: number = 1) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const semitone = Math.min(16, Math.max(0, matchCount * 2));
    const baseFreq = 587.33 * Math.pow(2, semitone / 12); // D5-based sparkle

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.33, now + 0.14);

    osc2.frequency.setValueAtTime(baseFreq * 1.5, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.18);

    gain.gain.setValueAtTime(0.14 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.02);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);
  }

  public playKenoClear() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    gain.gain.setValueAtTime(0.07 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // --- Royal Hi-Lo Synthesized SFX ---
  public playHiLoCardFlip() {
    this.playCardDeal();
  }

  public playHiLoCorrect(streak: number = 1) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const semitone = Math.min(18, Math.max(0, streak * 2));
    const baseFreq = 523.25 * Math.pow(2, semitone / 12); // C5 climbing

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.12);

    osc2.frequency.setValueAtTime(baseFreq * 1.5, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.16);

    gain.gain.setValueAtTime(0.14 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.02);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }

  public playHiLoPush() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    // Dual neutral tone
    [440, 440].forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.settings.sfxEnabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.08 * this.settings.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
      }, idx * 70);
    });
  }

  public playHiLoCashOut() {
    this.playCrashCashOut();
  }

  // --- Royal Horse Racing Synthesized SFX ---
  public playRaceCountdownTick(isGo: boolean = false) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 1046.5 : 523.25, now);
    if (isGo) {
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.16);
    }

    gain.gain.setValueAtTime((isGo ? 0.18 : 0.1) * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.28 : 0.12));

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + (isGo ? 0.3 : 0.14));
  }

  public playRaceStartBell() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    [880, 1320, 1760].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.02);

      gain.gain.setValueAtTime(0.12 * this.settings.masterVolume, now + idx * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.02);
      osc.stop(now + 0.48);
    });
  }

  public playHorseGallopStep() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 + Math.random() * 35, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);

    gain.gain.setValueAtTime(0.055 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // --- Royal Bingo Synthesized SFX ---
  public playBingoBallPop(ballNumber: number = 45) {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const baseFreq = 360 + (ballNumber % 15) * 28;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.06);

    gain.gain.setValueAtTime(0.1 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBingoMark() {
    this.initContext();
    if (!this.ctx || !this.settings.sfxEnabled) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(1108.73, now + 0.1);

    gain.gain.setValueAtTime(0.13 * this.settings.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playBingoMilestone(tier: 1 | 2 | 3) {
    if (tier === 3) {
      this.playBigWin();
    } else {
      this.playWin();
    }
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
