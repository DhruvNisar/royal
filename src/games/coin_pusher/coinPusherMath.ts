import { CoinPusherOutcomeCategory } from '../../types';

export const COIN_PUSHER_MIN_BET = 10;
export const COIN_PUSHER_MAX_BET = 5000;
export const COIN_PUSHER_QUICK_BETS = [10, 25, 50, 100, 250, 500, 1000] as const;
export const COIN_PUSHER_LANE_COUNT = 5;
export const COIN_PUSHER_TARGET_RTP = 0.95;

export interface CoinPusherOutcomeDefinition {
  category: CoinPusherOutcomeCategory;
  label: string;
  shortLabel: string;
  probability: number; // Exact probability summing to 1.00
  weightPercent: number; // Exact integer percentage out of 100
  multiplier: number; // Gross payout multiplier (includes original stake)
  trayTokenCount: number; // Exact number of visual tokens pushed into the collection tray
  description: string;
}

export const COIN_PUSHER_OUTCOMES: readonly CoinPusherOutcomeDefinition[] = [
  {
    category: 'NO_PRIZE',
    label: 'No Prize',
    shortLabel: 'No Drop',
    probability: 0.2,
    weightPercent: 20,
    multiplier: 0,
    trayTokenCount: 0,
    description: 'Shelf shifts forward, but no tokens fall past the front lip.',
  },
  {
    category: 'SMALL_PRIZE',
    label: 'Small Prize',
    shortLabel: 'Small',
    probability: 0.2,
    weightPercent: 20,
    multiplier: 0.5,
    trayTokenCount: 3,
    description: 'A small cluster of coins tumbles into the collection tray.',
  },
  {
    category: 'NORMAL_PRIZE',
    label: 'Normal Prize',
    shortLabel: 'Normal',
    probability: 0.4,
    weightPercent: 40,
    multiplier: 1.0,
    trayTokenCount: 6,
    description: 'A steady cascade of gold coins and emerald tokens drops into the tray.',
  },
  {
    category: 'BIG_PRIZE',
    label: 'Big Prize',
    shortLabel: 'Big Win',
    probability: 0.2,
    weightPercent: 20,
    multiplier: 2.25,
    trayTokenCount: 12,
    description: 'A massive royal avalanche of gold coins and ruby medallions pours into the tray!',
  },
] as const;

export function getCoinPusherOutcomeDefinition(
  category: CoinPusherOutcomeCategory
): CoinPusherOutcomeDefinition {
  return (
    COIN_PUSHER_OUTCOMES.find(o => o.category === category) ?? COIN_PUSHER_OUTCOMES[0]
  );
}

/**
 * Exact theoretical RTP:
 * (0.20 * 0) + (0.20 * 0.50) + (0.40 * 1.00) + (0.20 * 2.25) = 0.9500
 */
export function computeCoinPusherTheoreticalRtp(): number {
  return COIN_PUSHER_OUTCOMES.reduce(
    (sum, item) => sum + item.probability * item.multiplier,
    0
  );
}

/**
 * Computes gross payout (includes original stake) and net profit/loss.
 * Rounds consistently to ROYAL ACE whole-coin precision. Never adds bet twice.
 */
export function calculateCoinPusherPayout(
  bet: number,
  category: CoinPusherOutcomeCategory
): {
  multiplier: number;
  grossPayout: number;
  netProfit: number;
} {
  const def = getCoinPusherOutcomeDefinition(category);
  const safeBet = Number.isFinite(bet) && bet > 0 ? Math.round(bet) : 0;
  const grossPayout = Math.round(safeBet * def.multiplier);
  const netProfit = grossPayout - safeBet;
  return {
    multiplier: def.multiplier,
    grossPayout,
    netProfit,
  };
}
