import { BingoMilestoneId, BingoMilestoneOutcome } from '../../types';

export const BINGO_MIN_BET = 10;
export const BINGO_MAX_BET = 2000;
export const BINGO_DEFAULT_BET = 100;
export const BINGO_TOTAL_BALLS = 90;
export const BINGO_TARGET_RTP = 0.95;

export interface BingoMilestoneConfig {
  id: BingoMilestoneId;
  label: string;
  shortLabel: string;
  targetCalls: number;
  multiplier: number;
  description: string;
}

/**
 * 90-Ball Royal Bingo Challenge Milestones
 * Call targets & exact hypergeometric inclusion-exclusion probabilities:
 *   - One Line   (<= 35 calls): P = 2.2063%  -> 5.0x  (EV = 0.110315)
 *   - Two Lines  (<= 55 calls): P = 1.4819%  -> 10.0x (EV = 0.148190)
 *   - Full House (<= 75 calls): P = 4.9787%  -> 13.9x (EV = 0.692039)
 *
 * Exact combined theoretical RTP = 95.05% (0.950544), confirmed via 50,000-round Monte Carlo.
 */
export const BINGO_MILESTONES: Record<BingoMilestoneId, BingoMilestoneConfig> = {
  ONE_LINE: {
    id: 'ONE_LINE',
    label: 'One Line',
    shortLabel: '1 Line',
    targetCalls: 35,
    multiplier: 5.0,
    description: 'Complete any 1 horizontal row (5 numbers) within 35 calls.',
  },
  TWO_LINES: {
    id: 'TWO_LINES',
    label: 'Two Lines',
    shortLabel: '2 Lines',
    targetCalls: 55,
    multiplier: 10.0,
    description: 'Complete any 2 horizontal rows (10 numbers) within 55 calls.',
  },
  FULL_HOUSE: {
    id: 'FULL_HOUSE',
    label: 'Full House',
    shortLabel: 'Full House',
    targetCalls: 75,
    multiplier: 13.9,
    description: 'Complete all 3 horizontal rows (15 numbers) within 75 calls.',
  },
};

export const BINGO_MILESTONE_ORDER: BingoMilestoneId[] = [
  'ONE_LINE',
  'TWO_LINES',
  'FULL_HOUSE',
];

/**
 * Calculates whole-coin milestone reward consistently for both preview UI and settlement.
 */
export function calculateBingoMilestoneReward(bet: number, multiplier: number): number {
  if (!Number.isFinite(bet) || !Number.isFinite(multiplier) || bet <= 0 || multiplier <= 0) {
    return 0;
  }
  return Math.round(bet * multiplier);
}

/**
 * Computes total gross reward across all earned milestones.
 */
export function calculateTotalBingoReward(outcomes: BingoMilestoneOutcome[]): number {
  return outcomes.reduce((sum, item) => sum + (item.earned ? item.reward : 0), 0);
}

/**
 * Computes the maximum possible total payout if a player hits all 3 milestones in a single round.
 */
export function calculateMaxBingoPotentialReward(bet: number): number {
  return BINGO_MILESTONE_ORDER.reduce(
    (sum, id) => sum + calculateBingoMilestoneReward(bet, BINGO_MILESTONES[id].multiplier),
    0
  );
}

/**
 * Returns the visual decade color palette for a 90-ball bingo ball (1..90).
 */
export function getBingoBallColor(ballNumber: number): {
  bg: string;
  ring: string;
  text: string;
  decadeLabel: string;
} {
  if (ballNumber <= 9) {
    return { bg: '#dc2626', ring: '#fca5a5', text: '#ffffff', decadeLabel: '1–9' };
  }
  if (ballNumber <= 19) {
    return { bg: '#ea580c', ring: '#fdba74', text: '#ffffff', decadeLabel: '10–19' };
  }
  if (ballNumber <= 29) {
    return { bg: '#d97706', ring: '#fde047', text: '#ffffff', decadeLabel: '20–29' };
  }
  if (ballNumber <= 39) {
    return { bg: '#16a34a', ring: '#86efac', text: '#ffffff', decadeLabel: '30–39' };
  }
  if (ballNumber <= 49) {
    return { bg: '#0d9488', ring: '#5eead4', text: '#ffffff', decadeLabel: '40–49' };
  }
  if (ballNumber <= 59) {
    return { bg: '#2563eb', ring: '#93c5fd', text: '#ffffff', decadeLabel: '50–59' };
  }
  if (ballNumber <= 69) {
    return { bg: '#4f46e5', ring: '#a5b4fc', text: '#ffffff', decadeLabel: '60–69' };
  }
  if (ballNumber <= 79) {
    return { bg: '#9333ea', ring: '#d8b4fe', text: '#ffffff', decadeLabel: '70–79' };
  }
  return { bg: '#db2777', ring: '#f9a8d4', text: '#ffffff', decadeLabel: '80–90' };
}
