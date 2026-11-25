import {
  TreasurePathOutcome,
  TreasureStagePlan,
  TreasureTrailRoundResult,
  TreasureTrailStats,
} from '../../types';
import {
  TREASURE_MAX_BET,
  TREASURE_MIN_BET,
  TREASURE_STAGE_COUNT,
  TREASURE_STAGE_DEFINITIONS,
  getTreasureMultiplier,
} from './treasureMath';

export const TREASURE_HISTORY_STORAGE_KEY = 'royal_ace_treasure_trail_history_v1';
const MAX_HISTORY_ITEMS = 50;

/**
 * Cryptographically unbiased uniform integer in [0, maxExclusive).
 * Uses rejection sampling on crypto.getRandomValues — never Math.random.
 */
export function cryptoTreasureUniformInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 1) return 0;
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - ((maxUint32 + 1) % maxExclusive);
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value > limit);
  return value % maxExclusive;
}

/**
 * Generates and locks all 10 stages before gameplay starts.
 * Every stage has EXACTLY 2 safe paths and 1 trap path, placed uniformly at random.
 */
export function generateTreasureTrailPlan(): TreasureStagePlan[] {
  const plan: TreasureStagePlan[] = [];

  for (let i = 0; i < TREASURE_STAGE_COUNT; i++) {
    const meta = TREASURE_STAGE_DEFINITIONS[i];
    const trapPathIndex = cryptoTreasureUniformInt(3) as 0 | 1 | 2;
    const paths: [TreasurePathOutcome, TreasurePathOutcome, TreasurePathOutcome] = [
      'safe',
      'safe',
      'safe',
    ];
    paths[trapPathIndex] = 'trap';

    plan.push({
      stageNumber: meta.stageNumber,
      title: meta.title,
      relicName: meta.relicName,
      trapName: meta.trapName,
      trapPathIndex,
      paths,
      multiplier: getTreasureMultiplier(meta.stageNumber),
    });
  }

  return plan;
}

export function validateTreasureBet(
  bet: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(bet) || !Number.isInteger(bet)) {
    return { valid: false, error: 'Enter a valid whole-coin wager.' };
  }
  if (bet < TREASURE_MIN_BET) {
    return { valid: false, error: `Minimum wager is ${TREASURE_MIN_BET} coins.` };
  }
  if (bet > TREASURE_MAX_BET) {
    return {
      valid: false,
      error: `Maximum wager is ${TREASURE_MAX_BET.toLocaleString()} coins.`,
    };
  }
  if (bet > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

export function loadTreasureHistory(): TreasureTrailRoundResult[] {
  try {
    const raw = localStorage.getItem(TREASURE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn('Error loading Royal Treasure Trail history', e);
  }
  return [];
}

export function saveTreasureHistory(history: TreasureTrailRoundResult[]): void {
  try {
    localStorage.setItem(
      TREASURE_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch (e) {
    console.warn('Error saving Royal Treasure Trail history', e);
  }
}

export function calculateTreasureStats(history: TreasureTrailRoundResult[]): TreasureTrailStats {
  const roundsPlayed = history.length;
  let totalWagered = 0;
  let totalGrossWon = 0;
  let wins = 0;
  let losses = 0;
  let bestStage = 0;
  let biggestPayout = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalGrossWon += r.grossPayout;
    if (r.outcome === 'TRAP_LOSS') {
      losses += 1;
    } else {
      wins += 1;
    }
    if (r.stagesCompleted > bestStage) {
      bestStage = r.stagesCompleted;
    }
    if (r.grossPayout > biggestPayout) {
      biggestPayout = r.grossPayout;
    }
  }

  return {
    roundsPlayed,
    totalWagered,
    totalGrossWon,
    totalNetProfit: totalGrossWon - totalWagered,
    wins,
    losses,
    winRate: roundsPlayed > 0 ? (wins / roundsPlayed) * 100 : 0,
    bestStage,
    biggestPayout,
  };
}
