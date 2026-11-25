import React from 'react';
import { DealBriefcase } from '../../types';
import { formatDealMultiplier, isHighTierMultiplier } from './dealMath';
import { Lock } from 'lucide-react';

interface BriefcaseTileProps {
  briefcase: DealBriefcase;
  isSelectable: boolean;
  isHighlighted: boolean;
  isOpeningTarget: boolean;
  onSelect: (caseNumber: number) => void;
}

/**
 * Interactive brushed-gold luxury briefcase tile (1..26).
 * Preserves unopened mystery, distinguishes YOUR CASE with a royal gold aura & lock,
 * and shows revealed multiplier cleanly after opening.
 */
export const BriefcaseTile: React.FC<BriefcaseTileProps> = ({
  briefcase,
  isSelectable,
  isHighlighted,
  isOpeningTarget,
  onSelect,
}) => {
  const { caseNumber, multiplier, isOpened, isPlayerCase } = briefcase;
  const highTier = isHighTierMultiplier(multiplier);

  if (isOpened) {
    return (
      <div
        className="flex min-h-[54px] sm:min-h-[62px] flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/60 px-1 py-1.5 text-center opacity-55 select-none"
        aria-label={`Case ${caseNumber} opened, contained ${formatDealMultiplier(multiplier)}`}
      >
        <span className="text-[10px] font-bold text-slate-500 tabular-nums">
          #{caseNumber}
        </span>
        <span
          className={`mt-0.5 truncate max-w-full text-[10px] sm:text-xs font-extrabold tabular-nums line-through ${
            highTier ? 'text-rose-400/85' : 'text-sky-300/75'
          }`}
        >
          {formatDealMultiplier(multiplier)}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!isSelectable}
      onClick={() => onSelect(caseNumber)}
      aria-label={
        isPlayerCase
          ? `Your personal briefcase number ${caseNumber}, locked`
          : `Select briefcase number ${caseNumber}`
      }
      className={`group relative flex min-h-[54px] sm:min-h-[62px] w-full flex-col items-center justify-center rounded-xl border px-1 pt-2.5 pb-1.5 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        isPlayerCase
          ? 'border-amber-300 bg-gradient-to-b from-amber-400/30 via-amber-500/20 to-amber-900/40 shadow-[0_0_20px_rgba(251,191,36,0.42)] ring-2 ring-amber-400/60 cursor-default'
          : isOpeningTarget
          ? 'border-amber-200 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 scale-105 shadow-[0_0_24px_rgba(251,191,36,0.7)] animate-dnd-select'
          : isSelectable
          ? 'border-amber-500/55 bg-gradient-to-b from-[#3d2c0f] via-[#241b0b] to-[#130f08] hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_6px_16px_rgba(245,158,11,0.28)] active:scale-95 cursor-pointer'
          : 'border-slate-700/70 bg-gradient-to-b from-[#231d13] to-[#12100d] opacity-75 cursor-not-allowed'
      } ${isHighlighted ? 'animate-dnd-select' : ''}`}
    >
      {/* Top Briefcase Handle */}
      <span
        aria-hidden="true"
        className={`absolute -top-1.5 h-2 w-6 sm:w-7 rounded-t-md border-2 border-b-0 ${
          isPlayerCase
            ? 'border-amber-300 bg-amber-950/60'
            : 'border-amber-500/70 bg-slate-950/70 group-hover:border-amber-300'
        }`}
      />

      {/* Twin Metallic Latches */}
      <span
        aria-hidden="true"
        className="absolute top-1.5 left-2 h-1.5 w-1.5 rounded-[2px] bg-amber-300/80"
      />
      <span
        aria-hidden="true"
        className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-[2px] bg-amber-300/80"
      />

      {/* Center Metallic Number Plate */}
      <span
        className={`flex h-7 w-9 sm:h-8 sm:w-11 items-center justify-center rounded-md border text-sm sm:text-base font-black tabular-nums shadow-inner ${
          isPlayerCase
            ? 'border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950'
            : isOpeningTarget
            ? 'border-slate-900 bg-slate-950 text-amber-300'
            : 'border-amber-400/50 bg-gradient-to-b from-amber-200/95 via-amber-400/90 to-amber-600/90 text-slate-950 group-hover:from-amber-100 group-hover:to-amber-400'
        }`}
      >
        {caseNumber}
      </span>

      {/* YOUR CASE indicator */}
      {isPlayerCase && (
        <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-black tracking-wider text-amber-200">
          <Lock className="h-2.5 w-2.5" />
          <span>YOURS</span>
        </span>
      )}
    </button>
  );
};
