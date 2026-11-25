import React from 'react';
import {
  calculateDealCoins,
  DEAL_HIGH_TIER_MULTIPLIERS,
  DEAL_LOW_TIER_MULTIPLIERS,
  formatDealMultiplier,
} from './dealMath';
import { Crown } from 'lucide-react';

interface PrizeColumnProps {
  tier: 'low' | 'high';
  bet: number;
  eliminatedMultipliers: Set<number>;
  lastEliminatedMultiplier: number | null;
  lowestRemaining: number | null;
  highestRemaining: number | null;
  compact?: boolean;
}

export const PrizeColumn: React.FC<PrizeColumnProps> = ({
  tier,
  bet,
  eliminatedMultipliers,
  lastEliminatedMultiplier,
  lowestRemaining,
  highestRemaining,
  compact = false,
}) => {
  const list = tier === 'low' ? DEAL_LOW_TIER_MULTIPLIERS : DEAL_HIGH_TIER_MULTIPLIERS;
  const isHigh = tier === 'high';

  return (
    <div className="min-w-0 space-y-1">
      <div
        className={`flex items-center justify-between px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider ${
          isHigh ? 'text-amber-300' : 'text-sky-300'
        }`}
      >
        <span>{isHigh ? 'High Prizes' : 'Low Prizes'}</span>
        <span className="text-slate-500">Coins</span>
      </div>

      {list.map(mult => {
        const isEliminated = eliminatedMultipliers.has(mult);
        const isJustEliminated = lastEliminatedMultiplier === mult && isEliminated;
        const isHighestAlive = !isEliminated && highestRemaining === mult;
        const isLowestAlive = !isEliminated && lowestRemaining === mult;
        const coinValue = calculateDealCoins(bet, mult);

        return (
          <div
            key={mult}
            className={`flex items-center justify-between gap-1 rounded-lg border px-2 transition-opacity ${
              compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'
            } ${
              isEliminated
                ? `border-slate-800/60 bg-slate-950/50 text-slate-600 line-through opacity-40 ${
                    isJustEliminated ? 'animate-dnd-eliminate border-rose-500/70' : ''
                  }`
                : isHighestAlive
                ? 'border-amber-300 bg-gradient-to-r from-amber-500/30 via-amber-400/20 to-amber-600/25 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                : isHigh
                ? 'border-amber-500/35 bg-gradient-to-r from-[#241b09] to-[#17120a] text-amber-200'
                : isLowestAlive
                ? 'border-sky-400/50 bg-[#0d1c33] text-sky-200'
                : 'border-sky-500/25 bg-gradient-to-r from-[#0c172a] to-[#0a1220] text-sky-200'
            }`}
          >
            <span className="flex min-w-0 items-center gap-1 font-black tabular-nums">
              {isHighestAlive && (
                <Crown className="h-3 w-3 shrink-0 text-amber-300" aria-label="Highest remaining" />
              )}
              <span className="truncate">{formatDealMultiplier(mult)}</span>
            </span>

            <span
              className={`shrink-0 font-bold tabular-nums ${
                isEliminated
                  ? 'text-slate-600'
                  : isHigh
                  ? 'text-amber-300'
                  : 'text-slate-200'
              }`}
            >
              {coinValue.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
};
