import {
  CoinPusherOutcomeCategory,
  CoinPusherRoundResult,
  CoinPusherStats,
} from '../../types';
import {
  COIN_PUSHER_LANE_COUNT,
  COIN_PUSHER_MAX_BET,
  COIN_PUSHER_MIN_BET,
  calculateCoinPusherPayout,
  getCoinPusherOutcomeDefinition,
} from './coinPusherMath';

export const COIN_PUSHER_HISTORY_STORAGE_KEY = 'royal_ace_coin_pusher_history_v1';
const MAX_HISTORY_ITEMS = 50;

export type PusherTokenKind = 'gold_coin' | 'sapphire_token' | 'emerald_token' | 'ruby_medallion';

export interface ScriptedTrayDropToken {
  id: string;
  kind: PusherTokenKind;
  edgeXNorm: number; // 0.14 .. 0.86 along the front lip
  releaseDelayMs: number; // Relative to push phase start
  vx: number; // Horizontal drift
  bounceHeight: number;
  radius: number;
}

export interface CoinPusherDropPlan {
  roundId: string;
  lane: number; // 1..5
  bet: number;
  outcome: CoinPusherOutcomeCategory;
  outcomeLabel: string;
  multiplier: number;
  grossPayout: number;
  netProfit: number;
  trayTokens: ScriptedTrayDropToken[];
}

/**
 * Cryptographically unbiased uniform integer in [0, maxExclusive).
 * Uses rejection sampling on crypto.getRandomValues — never Math.random.
 */
export function cryptoCoinPusherUniformInt(maxExclusive: number): number {
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
 * Rolls outcome strictly according to published probabilities:
 * 0..19   (20%) -> NO_PRIZE (0x)
 * 20..39  (20%) -> SMALL_PRIZE (0.50x)
 * 40..79  (40%) -> NORMAL_PRIZE (1.00x)
 * 80..99  (20%) -> BIG_PRIZE (2.25x)
 * Lane selection never influences this roll.
 */
export function rollCoinPusherOutcome(): CoinPusherOutcomeCategory {
  const roll = cryptoCoinPusherUniformInt(100);
  if (roll < 20) return 'NO_PRIZE';
  if (roll < 40) return 'SMALL_PRIZE';
  if (roll < 80) return 'NORMAL_PRIZE';
  return 'BIG_PRIZE';
}

/**
 * Builds the complete locked round & deterministic visual choreography BEFORE animation starts.
 * Guarantees 100% alignment between generated outcome, tray coin drops, and wallet payout.
 */
export function createCoinPusherDropPlan(
  roundId: string,
  bet: number,
  lane: number
): CoinPusherDropPlan {
  const safeLane = Math.max(1, Math.min(COIN_PUSHER_LANE_COUNT, Math.floor(lane)));
  const outcome = rollCoinPusherOutcome();
  const def = getCoinPusherOutcomeDefinition(outcome);
  const { multiplier, grossPayout, netProfit } = calculateCoinPusherPayout(bet, outcome);

  // Center visual drops around the selected lane while keeping all tokens inside the tray
  const laneCenterNorm = 0.16 + ((safeLane - 1) / (COIN_PUSHER_LANE_COUNT - 1)) * 0.68;
  const trayTokens: ScriptedTrayDropToken[] = [];

  const tokenCount = def.trayTokenCount;
  for (let i = 0; i < tokenCount; i++) {
    const jitter = (cryptoCoinPusherUniformInt(101) - 50) / 260; // approx -0.19..+0.19
    const edgeXNorm = Math.max(0.14, Math.min(0.86, laneCenterNorm + jitter));

    let kind: PusherTokenKind = 'gold_coin';
    let radius = 11.5;

    if (outcome === 'SMALL_PRIZE' && i === tokenCount - 1) {
      kind = 'sapphire_token';
      radius = 12.5;
    } else if (outcome === 'NORMAL_PRIZE' && (i === 2 || i === 5)) {
      kind = 'emerald_token';
      radius = 13;
    } else if (outcome === 'BIG_PRIZE') {
      if (i === 3 || i === 7 || i === 10) {
        kind = 'ruby_medallion';
        radius = 14.5;
      } else if (i === 5 || i === 11) {
        kind = 'emerald_token';
        radius = 13.5;
      }
    }

    trayTokens.push({
      id: `${roundId}_tok_${i}`,
      kind,
      edgeXNorm,
      releaseDelayMs: i * (outcome === 'BIG_PRIZE' ? 58 : 85),
      vx: ((cryptoCoinPusherUniformInt(41) - 20) / 20) * 0.35,
      bounceHeight: 16 + cryptoCoinPusherUniformInt(14),
      radius,
    });
  }

  return {
    roundId,
    lane: safeLane,
    bet: Math.round(bet),
    outcome,
    outcomeLabel: def.label,
    multiplier,
    grossPayout,
    netProfit,
    trayTokens,
  };
}

export function validateCoinPusherBet(
  bet: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!Number.isFinite(bet) || !Number.isInteger(bet)) {
    return { valid: false, error: 'Enter a valid whole-coin wager.' };
  }
  if (bet < COIN_PUSHER_MIN_BET) {
    return { valid: false, error: `Minimum bet per drop is ${COIN_PUSHER_MIN_BET} coins.` };
  }
  if (bet > COIN_PUSHER_MAX_BET) {
    return {
      valid: false,
      error: `Maximum bet per drop is ${COIN_PUSHER_MAX_BET.toLocaleString()} coins.`,
    };
  }
  if (bet > balance) {
    return { valid: false, error: 'Insufficient virtual coin balance.' };
  }
  return { valid: true };
}

export function loadCoinPusherHistory(): CoinPusherRoundResult[] {
  try {
    const raw = localStorage.getItem(COIN_PUSHER_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.warn('Error loading Royal Coin Pusher history', e);
  }
  return [];
}

export function saveCoinPusherHistory(history: CoinPusherRoundResult[]): void {
  try {
    localStorage.setItem(
      COIN_PUSHER_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch (e) {
    console.warn('Error saving Royal Coin Pusher history', e);
  }
}

export function calculateCoinPusherStats(history: CoinPusherRoundResult[]): CoinPusherStats {
  let totalWagered = 0;
  let totalGrossWon = 0;
  let noPrizeCount = 0;
  let smallPrizeCount = 0;
  let normalPrizeCount = 0;
  let bigPrizeCount = 0;
  let biggestPayout = 0;

  for (const r of history) {
    totalWagered += r.bet;
    totalGrossWon += r.grossPayout;
    if (r.outcome === 'NO_PRIZE') noPrizeCount += 1;
    else if (r.outcome === 'SMALL_PRIZE') smallPrizeCount += 1;
    else if (r.outcome === 'NORMAL_PRIZE') normalPrizeCount += 1;
    else if (r.outcome === 'BIG_PRIZE') bigPrizeCount += 1;
    if (r.grossPayout > biggestPayout) biggestPayout = r.grossPayout;
  }

  return {
    dropsPlayed: history.length,
    totalWagered,
    totalGrossWon,
    totalNetProfit: totalGrossWon - totalWagered,
    noPrizeCount,
    smallPrizeCount,
    normalPrizeCount,
    bigPrizeCount,
    biggestPayout,
  };
}
