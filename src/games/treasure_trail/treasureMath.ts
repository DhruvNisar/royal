export const TREASURE_STAGE_COUNT = 10;
export const TREASURE_PATHS_PER_STAGE = 3;
export const TREASURE_SAFE_PATHS_PER_STAGE = 2;
export const TREASURE_TARGET_RTP = 0.95;

export const TREASURE_MIN_BET = 10;
export const TREASURE_MAX_BET = 5000;
export const TREASURE_QUICK_BETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export interface TreasureStageMetadata {
  stageNumber: number;
  title: string;
  shortTitle: string;
  relicName: string;
  trapName: string;
  chamberTone: string;
}

export const TREASURE_STAGE_DEFINITIONS: readonly TreasureStageMetadata[] = [
  {
    stageNumber: 1,
    title: 'Sunken Pier Gate',
    shortTitle: 'Pier',
    relicName: 'Gilded Compass',
    trapName: 'Rotten Planks',
    chamberTone: 'from-amber-950/35 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 2,
    title: 'Mossy Stone Archway',
    shortTitle: 'Arch',
    relicName: 'Jade Medallion',
    trapName: 'Snare Vines',
    chamberTone: 'from-emerald-950/30 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 3,
    title: 'Torchlit Steps',
    shortTitle: 'Steps',
    relicName: 'Sunburst Chalice',
    trapName: 'Falling Stones',
    chamberTone: 'from-orange-950/30 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 4,
    title: 'Serpent Bridge',
    shortTitle: 'Bridge',
    relicName: 'Emerald Idol',
    trapName: 'Venom Darts',
    chamberTone: 'from-teal-950/30 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 5,
    title: 'Obsidian Hall',
    shortTitle: 'Hall',
    relicName: 'Royal Signet',
    trapName: 'Flame Vent',
    chamberTone: 'from-stone-900/50 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 6,
    title: 'Amber Crypt',
    shortTitle: 'Crypt',
    relicName: 'Amber Crown',
    trapName: 'Spike Pit',
    chamberTone: 'from-amber-900/30 via-[#141722] to-[#0e1118]',
  },
  {
    stageNumber: 7,
    title: 'Sapphire Cloister',
    shortTitle: 'Cloister',
    relicName: 'Oceanic Scepter',
    trapName: 'Collapsing Tile',
    chamberTone: 'from-sky-950/35 via-[#131722] to-[#0e1118]',
  },
  {
    stageNumber: 8,
    title: 'Gilded Vault',
    shortTitle: 'Vault',
    relicName: 'Sovereign Bullion',
    trapName: 'Pendulum Blade',
    chamberTone: 'from-yellow-950/35 via-[#141722] to-[#0e1118]',
  },
  {
    stageNumber: 9,
    title: 'Emperor Chamber',
    shortTitle: 'Chamber',
    relicName: 'Ruby Diadem',
    trapName: 'Cursed Idol',
    chamberTone: 'from-rose-950/30 via-[#141722] to-[#0e1118]',
  },
  {
    stageNumber: 10,
    title: 'Crown Relic Sanctum',
    shortTitle: 'Sanctum',
    relicName: 'Imperial Crown Chest',
    trapName: 'Guardian Seal',
    chamberTone: 'from-amber-800/35 via-[#18151d] to-[#0e1118]',
  },
];

/**
 * Exact survival probability after k consecutive stages: P(k) = (2/3)^k
 */
export function getTreasureSurvivalProbability(stagesCompleted: number): number {
  if (stagesCompleted <= 0) return 1;
  return Math.pow(TREASURE_SAFE_PATHS_PER_STAGE / TREASURE_PATHS_PER_STAGE, stagesCompleted);
}

/**
 * Exact gross payout multiplier at full IEEE-754 precision:
 * M(k) = 0.95 / (2/3)^k = 0.95 * (1.5)^k
 * Includes the original stake (gross multiplier).
 */
export function getTreasureMultiplier(stagesCompleted: number): number {
  if (stagesCompleted <= 0) return 0;
  const clamped = Math.min(TREASURE_STAGE_COUNT, Math.floor(stagesCompleted));
  return TREASURE_TARGET_RTP * Math.pow(1.5, clamped);
}

/**
 * Precomputed exact multiplier table for stages 1..10.
 */
export const TREASURE_STAGE_MULTIPLIERS: readonly number[] = Array.from(
  { length: TREASURE_STAGE_COUNT },
  (_, idx) => getTreasureMultiplier(idx + 1)
);

export const TREASURE_MAX_MULTIPLIER = getTreasureMultiplier(TREASURE_STAGE_COUNT);

/**
 * Gross payout in virtual coins matching ROYAL ACE's whole-coin wallet precision.
 * Uses full-precision multiplier internally and rounds only the final credit/display value.
 * Gross payout already includes the original stake — never add bet twice.
 */
export function calculateTreasureGrossPayout(bet: number, stagesCompleted: number): number {
  if (!Number.isFinite(bet) || bet <= 0 || stagesCompleted <= 0) return 0;
  return Math.round(bet * getTreasureMultiplier(stagesCompleted));
}

export function calculateTreasureNetProfit(bet: number, grossPayout: number): number {
  if (!Number.isFinite(bet) || !Number.isFinite(grossPayout)) return 0;
  return grossPayout - Math.round(bet);
}

export function formatTreasureMultiplier(multiplier: number, compact: boolean = false): string {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return '0×';
  if (compact) {
    if (multiplier >= 10) return `${multiplier.toFixed(1)}×`;
    return `${multiplier.toFixed(2)}×`;
  }
  if (multiplier < 5) {
    return `${Number(multiplier.toFixed(4))}×`;
  }
  if (multiplier < 20) {
    return `${Number(multiplier.toFixed(3))}×`;
  }
  return `${Number(multiplier.toFixed(2))}×`;
}
