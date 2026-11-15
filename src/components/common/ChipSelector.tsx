import React from 'react';
import { ChipDenomination, CHIP_DENOMINATIONS, CHIP_COLORS } from '../../types';
import { soundManager } from '../../services/sound';
import { Trash2, TrendingUp, Maximize2 } from 'lucide-react';

interface ChipSelectorProps {
  selectedChip: ChipDenomination;
  onSelectChip: (chip: ChipDenomination) => void;
  currentBet?: number;
  availableBalance: number;
  onClearBets?: () => void;
  onDoubleBet?: () => void;
  onAllIn?: () => void;
  disabled?: boolean;
}

export const ChipSelector: React.FC<ChipSelectorProps> = ({
  selectedChip,
  onSelectChip,
  currentBet = 0,
  availableBalance,
  onClearBets,
  onDoubleBet,
  onAllIn,
  disabled = false,
}) => {
  const handleChipClick = (chip: ChipDenomination) => {
    if (disabled) return;
    soundManager.playChipClick();
    onSelectChip(chip);
  };

  return (
    <div className="w-full bg-[#111318]/95 border-t border-slate-800/80 px-3 py-2.5 sm:px-6 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
      {/* Bet Summary */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">Current Wager</span>
          <div className="flex items-baseline gap-1">
            <span className="text-amber-400 font-serif font-black text-lg sm:text-xl tabular-nums">
              {currentBet.toLocaleString()}
            </span>
            <span className="text-[11px] text-slate-400">coins</span>
          </div>
        </div>

        {/* Quick Bet Controls */}
        <div className="flex items-center gap-1.5">
          {onClearBets && currentBet > 0 && (
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onClearBets();
              }}
              disabled={disabled}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Clear all bets"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onDoubleBet && currentBet > 0 && availableBalance >= currentBet && (
            <button
              type="button"
              onClick={() => {
                soundManager.playChipStack();
                onDoubleBet();
              }}
              disabled={disabled}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/40 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
              title="Double current bet"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">2x Bet</span>
            </button>
          )}

          {onAllIn && availableBalance > 0 && (
            <button
              type="button"
              onClick={() => {
                soundManager.playChipStack();
                onAllIn();
              }}
              disabled={disabled}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded bg-red-950/60 hover:bg-red-900/80 border border-red-600/40 text-red-300 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
              title="All-in remaining balance"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">All-In</span>
            </button>
          )}
        </div>
      </div>

      {/* Chip Denominations */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto max-w-full py-1 px-1">
        {CHIP_DENOMINATIONS.map(chip => {
          const isSelected = selectedChip === chip;
          const styling = CHIP_COLORS[chip];
          const canAfford = availableBalance >= chip;

          return (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              disabled={disabled || !canAfford}
              className={`relative rounded-full transition-all duration-200 shrink-0 select-none flex items-center justify-center ${
                isSelected
                  ? 'scale-110 -translate-y-1.5 ring-2 ring-amber-300 shadow-lg shadow-amber-400/30'
                  : 'hover:scale-105 active:scale-95 opacity-90 hover:opacity-100'
              } ${!canAfford ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                width: '44px',
                height: '44px',
                backgroundColor: styling.bg,
                borderColor: styling.border,
                borderWidth: '3px',
                borderStyle: 'dashed',
              }}
            >
              {/* Inner ring */}
              <div
                className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center font-bold text-xs tabular-nums shadow-inner"
                style={{ color: styling.text, backgroundColor: 'rgba(0,0,0,0.35)' }}
              >
                {chip >= 1000 ? `${chip / 1000}k` : chip}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
