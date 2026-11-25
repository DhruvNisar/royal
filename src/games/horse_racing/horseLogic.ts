import {
  HorseRunner,
  HorseRaceResult,
  HorseRaceStats,
} from '../../types';
import {
  HORSE_MIN_BET,
  HORSE_MAX_BET,
  HORSE_TARGET_RTP,
  HORSE_COUNT,
  computePlackettLuceDistribution,
  calculateBetEventProbability,
  calculateGrossMultiplier,
  PlackettLuceOrder,
} from './horseMath';

export const HORSE_HISTORY_STORAGE_KEY = 'royal_ace_horse_racing_history_v1';
export const HORSE_MAX_HISTORY_ENTRIES = 50;

const HORSE_NAME_POOL = [
  'Thunder Bolt',
  'Royal Storm',
  'Golden Arrow',
  'Midnight King',
  'Silver Blaze',
  'Desert Flash',
  'Velvet Crown',
  'Emerald Spirit',
  'Crimson Comet',
  'Sovereign Jet',
  'Noble Phantom',
  'Sapphire Fury',
  'Copper Mirage',
  'Imperial Dash',
  'Obsidian Star',
  'Sterling Gale',
  'Amber Monarch',
  'Celtic Eclipse',
];

const RACE_TITLES = [
  'Royal Ace Grand Derby',
  'Sovereign Gold Cup',
  'Emerald Turf Classic',
  'Crown Jewel Sprint',
  'Midnight Stakes',
  'Imperial Mile Invitational',
  'Golden Furlong Championship',
  'Monaco Night Derby',
];

const LANE_SILKS: { primary: string; secondary: string; coat: string; mane: string }[] = [
  { primary: '#ef4444', secondary: '#fef08a', coat: '#6b3a24', mane: '#1c110a' }, // Lane 1: Crimson & Gold
  { primary: '#3b82f6', secondary: '#ffffff', coat: '#2b1e1a', mane: '#0f0a08' }, // Lane 2: Royal Blue & White
  { primary: '#f59e0b', secondary: '#111827', coat: '#92400e', mane: '#451a03' }, // Lane 3: Gold & Obsidian
  { primary: '#10b981', secondary: '#ecfdf5', coat: '#4a2c1d', mane: '#1f120b' }, // Lane 4: Emerald & Ivory
  { primary: '#a855f7', secondary: '#fde047', coat: '#78716c', mane: '#e7e5e4' }, // Lane 5: Violet & Gold (Dapple Grey)
  { primary: '#ec4899', secondary: '#ffffff', coat: '#7c2d12', mane: '#27120a' }, // Lane 6: Magenta & White
];

/**
 * Unbiased cryptographic uniform integer in [0, upperBoundExclusive) via rejection sampling.
 */
export function cryptoUniformIndex(upperBoundExclusive: number): number {
  if (!Number.isInteger(upperBoundExclusive) || upperBoundExclusive <= 0) {
    throw new Error(`Invalid upper bound: ${upperBoundExclusive}`);
  }
  if (upperBoundExclusive === 1) return 0;

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographic randomness API is unavailable in this environment.');
  }

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % upperBoundExclusive);
  const buf = new Uint32Array(1);

  while (true) {
    cryptoObj.getRandomValues(buf);
    const val = buf[0];
    if (val < limit) {
      return val % upperBoundExclusive;
    }
  }
}

/**
 * Unbiased cryptographic uniform float in [0, 1).
 */
export function cryptoRandomUnit(): number {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('Cryptographic randomness API is unavailable in this environment.');
  }
  const buf = new Uint32Array(1);
  cryptoObj.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

/**
 * Cryptographic Fisher-Yates shuffle helper.
 */
function cryptoShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoUniformIndex(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export interface RaceFieldSetup {
  raceNumber: number;
  raceTitle: string;
  runners: HorseRunner[];
  distribution: PlackettLuceOrder[];
}

/**
 * Generates a fresh 6-horse race lineup with balanced randomized strengths,
 * unique names, distinct racing silks, and precomputed exact Plackett-Luce odds.
 */
export function createRaceField(raceNumber: number): RaceFieldSetup {
  const chosenNames = cryptoShuffle(HORSE_NAME_POOL).slice(0, HORSE_COUNT);
  const raceTitle = RACE_TITLES[(raceNumber - 1) % RACE_TITLES.length];

  // Realistic strength tiers (favorite, co-contenders, mid-pack, longshots) shuffled across lanes
  const baseWeights = cryptoShuffle([32, 24, 19, 15, 11, 8]).map(base => {
    const jitter = cryptoUniformIndex(5) - 2; // -2 to +2
    return Math.max(6, base + jitter);
  });

  const maxWeight = Math.max(...baseWeights);
  const minWeight = Math.min(...baseWeights);

  const rawRunners = baseWeights.map((weight, idx) => {
    const num = (idx + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const silk = LANE_SILKS[idx];
    // Map weight cleanly to display rating 68..96
    const ratingSpan = maxWeight === minWeight ? 0.5 : (weight - minWeight) / (maxWeight - minWeight);
    const rating = Math.round(68 + ratingSpan * 28);

    return {
      number: num,
      name: chosenNames[idx],
      silkPrimary: silk.primary,
      silkSecondary: silk.secondary,
      coatColor: silk.coat,
      maneColor: silk.mane,
      strengthWeight: weight,
      rating,
      winProbability: 0,
      winMultiplier: 0,
      placeMultiplier: 0,
      showMultiplier: 0,
    };
  });

  const distribution = computePlackettLuceDistribution(rawRunners);

  const runners: HorseRunner[] = rawRunners.map(r => {
    const pWin = calculateBetEventProbability(distribution, 'WIN', [r.number]);
    const pPlace = calculateBetEventProbability(distribution, 'PLACE', [r.number]);
    const pShow = calculateBetEventProbability(distribution, 'SHOW', [r.number]);
    return {
      ...r,
      winProbability: pWin,
      winMultiplier: calculateGrossMultiplier(pWin, HORSE_TARGET_RTP),
      placeMultiplier: calculateGrossMultiplier(pPlace, HORSE_TARGET_RTP),
      showMultiplier: calculateGrossMultiplier(pShow, HORSE_TARGET_RTP),
    };
  });

  return {
    raceNumber,
    raceTitle,
    runners,
    distribution,
  };
}

/**
 * Samples a complete 6-horse finishing order WITHOUT REPLACEMENT
 * strictly following the Plackett-Luce strength model using crypto.getRandomValues.
 */
export function generateWeightedFinishOrder(runners: HorseRunner[]): number[] {
  const pool = [...runners];
  const order: number[] = [];

  while (pool.length > 0) {
    const totalWeight = pool.reduce((sum, r) => sum + r.strengthWeight, 0);
    const threshold = cryptoRandomUnit() * totalWeight;
    let cumulative = 0;
    let selectedIdx = pool.length - 1;

    for (let i = 0; i < pool.length; i++) {
      cumulative += pool[i].strengthWeight;
      if (threshold < cumulative) {
        selectedIdx = i;
        break;
      }
    }

    const [chosen] = pool.splice(selectedIdx, 1);
    order.push(chosen.number);
  }

  return order;
}

export interface HorseTrajectory {
  horseNumber: number;
  finishRank: number; // 1..6
  finishTimeMs: number;
  // Mid-race surge parameters (purely visual; finishTimeMs is strictly locked)
  breakBurst: number;
  midWaveAmp: number;
  midWaveFreq: number;
  midWavePhase: number;
}

export interface RaceAnimationPlan {
  finishOrder: number[];
  winnerFinishMs: number;
  lastFinishMs: number;
  trajectories: Record<number, HorseTrajectory>;
}

/**
 * Builds deterministic, realistic race trajectories where horses break from the gate,
 * trade leads during the middle furlongs, and sprint to the wire crossing in the
 * EXACT locked finishOrder.
 */
export function createRaceAnimationPlan(finishOrder: number[]): RaceAnimationPlan {
  const winnerFinishMs = 8000;
  let runningTime = winnerFinishMs;
  const trajectories: Record<number, HorseTrajectory> = {};

  finishOrder.forEach((horseNum, rankIdx) => {
    if (rankIdx > 0) {
      // Realistic photo-finish or length gaps (140ms to 420ms between positions)
      const gap = 150 + cryptoUniformIndex(260);
      runningTime += gap;
    }

    // Visual mid-race personality (early speed vs closer) that vanishes cleanly before the finish line
    const breakBurst = (cryptoRandomUnit() - 0.5) * 0.14;
    const midWaveAmp = 0.03 + cryptoRandomUnit() * 0.055;
    const midWaveFreq = 1.6 + cryptoRandomUnit() * 1.4;
    const midWavePhase = cryptoRandomUnit() * Math.PI * 2;

    trajectories[horseNum] = {
      horseNumber: horseNum,
      finishRank: rankIdx + 1,
      finishTimeMs: runningTime,
      breakBurst,
      midWaveAmp,
      midWaveFreq,
      midWavePhase,
    };
  });

  return {
    finishOrder,
    winnerFinishMs,
    lastFinishMs: runningTime,
    trajectories,
  };
}

/**
 * Evaluates a horse's track progress in [0, 1.04] at elapsedMs.
 * At elapsedMs === finishTimeMs, progress is EXACTLY 1.00 (crossing the finish wire).
 * After crossing, the horse smoothly decelerates into the run-out zone (up to 1.04).
 */
export function sampleHorseProgress(trajectory: HorseTrajectory, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;

  const u = elapsedMs / trajectory.finishTimeMs;

  if (u >= 1) {
    // Gentle post-wire deceleration into run-out
    const post = Math.min(1, (elapsedMs - trajectory.finishTimeMs) / 1400);
    return 1 + 0.038 * (1 - Math.pow(1 - post, 2));
  }

  // Smooth acceleration out of gate + steady cruise + stretch drive
  // Base curve strictly satisfies base(0) = 0, base(1) = 1
  const gateEase = Math.pow(u, 1.16);
  const stretchKick = 0.04 * Math.sin(u * Math.PI);
  const base = gateEase + stretchKick * (1 - u);

  // Envelope that is 0 at u=0 and cleanly 0 by u=0.92 so finish order is 100% locked
  const envelope = u < 0.92 ? Math.sin((u / 0.92) * Math.PI) : 0;
  const earlyPush = trajectory.breakBurst * envelope * (1 - u);
  const surgeWave =
    trajectory.midWaveAmp *
    Math.sin(u * Math.PI * trajectory.midWaveFreq + trajectory.midWavePhase) *
    envelope;

  const raw = base + earlyPush + surgeWave;
  return Math.max(0, Math.min(0.996, raw));
}

/**
 * Validates wager amount against limits and balance.
 */
export function validateHorseBetAmount(
  amount: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    return { valid: false, error: 'Bet must be a whole number of virtual coins.' };
  }
  if (amount < HORSE_MIN_BET) {
    return { valid: false, error: `Minimum bet is ${HORSE_MIN_BET} coins.` };
  }
  if (amount > HORSE_MAX_BET) {
    return { valid: false, error: `Maximum bet is ${HORSE_MAX_BET.toLocaleString()} coins.` };
  }
  if (amount > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance for this bet.' };
  }
  return { valid: true };
}

/**
 * Loads Horse Racing history from localStorage (max 50 rounds).
 */
export function loadHorseHistory(): HorseRaceResult[] {
  try {
    const raw = localStorage.getItem(HORSE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is HorseRaceResult =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.timestamp === 'number' &&
          Array.isArray(item.finishOrder) &&
          typeof item.betAmount === 'number' &&
          typeof item.payout === 'number'
      )
      .slice(0, HORSE_MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function saveHorseHistory(history: HorseRaceResult[]): void {
  try {
    localStorage.setItem(
      HORSE_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, HORSE_MAX_HISTORY_ENTRIES))
    );
  } catch {
    // Ignore quota errors
  }
}

export function appendHorseHistoryRecord(record: HorseRaceResult): HorseRaceResult[] {
  const existing = loadHorseHistory();
  const updated = [record, ...existing].slice(0, HORSE_MAX_HISTORY_ENTRIES);
  saveHorseHistory(updated);
  return updated;
}

export function calculateHorseStats(history: HorseRaceResult[]): HorseRaceStats {
  const racesPlayed = history.length;
  let totalWagered = 0;
  let totalWon = 0;
  let wins = 0;
  let bestPayout = 0;

  for (const r of history) {
    totalWagered += r.betAmount;
    totalWon += r.payout;
    if (r.isWin) {
      wins++;
      if (r.payout > bestPayout) bestPayout = r.payout;
    }
  }

  const losses = racesPlayed - wins;
  const netProfit = totalWon - totalWagered;
  const winRate = racesPlayed > 0 ? (wins / racesPlayed) * 100 : 0;

  return {
    racesPlayed,
    totalWagered,
    totalWon,
    netProfit,
    wins,
    losses,
    winRate,
    bestPayout,
  };
}
