import React from 'react';
import { TreasurePathOutcome } from '../../types';
import { Skull, Sparkles, Lock, Flame } from 'lucide-react';

interface TreasureDoorCardProps {
  pathIndex: 0 | 1 | 2;
  stageNumber: number;
  relicName: string;
  trapName: string;
  revealedOutcome: TreasurePathOutcome | null;
  isSelected: boolean;
  isDisabled: boolean;
  isIdlePreview: boolean;
  onSelect: (pathIndex: 0 | 1 | 2) => void;
}

const ROMAN_NUMERALS = ['I', 'II', 'III'] as const;
const PATH_NAMES = ['Left Path', 'Center Path', 'Right Path'] as const;

export const TreasureDoorCard: React.FC<TreasureDoorCardProps> = ({
  pathIndex,
  stageNumber,
  relicName,
  trapName,
  revealedOutcome,
  isSelected,
  isDisabled,
  isIdlePreview,
  onSelect,
}) => {
  const isRevealed = revealedOutcome !== null;
  const isSafe = revealedOutcome === 'safe';
  const isTrap = revealedOutcome === 'trap';

  const containerStateClasses = isRevealed
    ? isSafe
      ? isSelected
        ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 via-[#1a1710] to-[#0f1014] shadow-[0_0_28px_rgba(245,158,11,0.28)] animate-treasure-reveal'
        : 'border-emerald-500/35 bg-gradient-to-b from-emerald-950/35 via-[#131718] to-[#0e1014] opacity-75'
      : isSelected
        ? 'border-rose-500 bg-gradient-to-b from-rose-950/75 via-[#1e1015] to-[#110c0f] shadow-[0_0_28px_rgba(244,63,94,0.3)] animate-treasure-trap'
        : 'border-rose-500/35 bg-gradient-to-b from-rose-950/35 via-[#191216] to-[#0f0d11] opacity-75'
    : isIdlePreview
      ? 'border-amber-500/20 bg-gradient-to-b from-[#1a1611] via-[#13151d] to-[#0d0f15] opacity-85 cursor-default'
      : 'border-amber-500/35 hover:border-amber-400 bg-gradient-to-b from-[#1f1911] via-[#151720] to-[#0d0f15] hover:-translate-y-1 active:scale-[0.98] shadow-lg hover:shadow-amber-500/20 cursor-pointer';

  return (
    <button
      type="button"
      disabled={isDisabled || isRevealed || isIdlePreview}
      onClick={() => onSelect(pathIndex)}
      aria-label={`Stage ${stageNumber} Door ${ROMAN_NUMERALS[pathIndex]} (${PATH_NAMES[pathIndex]})`}
      className={`group relative w-full min-w-0 rounded-2xl border p-2 sm:p-3.5 transition-all duration-200 flex flex-col items-center justify-between text-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 min-h-[154px] sm:min-h-[214px] ${containerStateClasses}`}
    >
      {/* Top Arch Header */}
      <div className="w-full flex items-center justify-between gap-1 text-[10px] sm:text-xs font-semibold">
        <span className="font-serif text-amber-300/90 tracking-wider">
          DOOR {ROMAN_NUMERALS[pathIndex]}
        </span>
        {isRevealed ? (
          <span
            className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wide ${
              isSafe ? 'text-emerald-300' : 'text-rose-400'
            }`}
          >
            {isSelected ? (isSafe ? 'Found' : 'Trap!') : isSafe ? 'Safe' : 'Trap'}
          </span>
        ) : (
          <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden xs:inline">
            {PATH_NAMES[pathIndex]}
          </span>
        )}
      </div>

      {/* Central Visual Illustration */}
      <div className="relative my-2 sm:my-3 flex items-center justify-center w-full">
        {!isRevealed ? (
          /* Carved Ancient Golden Temple Door SVG */
          <div className="relative w-16 h-20 sm:w-24 sm:h-28 flex items-center justify-center">
            <svg
              viewBox="0 0 100 120"
              className="w-full h-full drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`archStone-${pathIndex}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5a4932" />
                  <stop offset="50%" stopColor="#2c2419" />
                  <stop offset="100%" stopColor="#181410" />
                </linearGradient>
                <linearGradient id={`goldTrim-${pathIndex}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="50%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#926a19" />
                </linearGradient>
              </defs>
              {/* Outer Stone Arch */}
              <path
                d="M12 116 L12 46 A38 38 0 0 1 88 46 L88 116 Z"
                fill={`url(#archStone-${pathIndex})`}
                stroke={`url(#goldTrim-${pathIndex})`}
                strokeWidth="3.5"
              />
              {/* Inner Carved Double Door */}
              <path
                d="M21 112 L21 48 A29 29 0 0 1 79 48 L79 112 Z"
                fill="#1b150e"
                stroke="#b58d24"
                strokeWidth="1.8"
              />
              {/* Center Seam */}
              <line x1="50" y1="20" x2="50" y2="112" stroke="#d4af37" strokeWidth="1.6" strokeOpacity="0.65" />
              {/* Ornate Sun Crest */}
              <circle
                cx="50"
                cy="58"
                r="13"
                fill="#291f12"
                stroke={`url(#goldTrim-${pathIndex})`}
                strokeWidth="2.2"
              />
              <circle cx="50" cy="58" r="5" fill="#f59e0b" fillOpacity="0.85" />
              {/* Twin Door Rings */}
              <circle cx="38" cy="80" r="3.5" fill="none" stroke="#eab308" strokeWidth="1.6" />
              <circle cx="62" cy="80" r="3.5" fill="none" stroke="#eab308" strokeWidth="1.6" />
              {/* Bottom Stone Step */}
              <rect x="6" y="112" width="88" height="6" rx="2" fill="#3a2f22" stroke="#85651d" strokeWidth="1" />
            </svg>
            {!isIdlePreview && !isDisabled && (
              <div className="absolute -top-1 -right-1 text-amber-400/90 animate-treasure-torch">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400/70" />
              </div>
            )}
          </div>
        ) : isSafe ? (
          /* Revealed Golden Treasure Chest */
          <div className="relative w-16 h-20 sm:w-24 sm:h-28 flex items-center justify-center animate-treasure-float">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_16px_rgba(245,158,11,0.5)]" aria-hidden="true">
              <defs>
                <radialGradient id={`chestGlow-${pathIndex}`} cx="50%" cy="45%" r="50%">
                  <stop offset="0%" stopColor="#fde047" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`chestGold-${pathIndex}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#a16207" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="46" r="42" fill={`url(#chestGlow-${pathIndex})`} />
              {/* Open Lid */}
              <path
                d="M16 42 Q50 14 84 42 L80 50 L20 50 Z"
                fill="#5c3114"
                stroke={`url(#chestGold-${pathIndex})`}
                strokeWidth="3"
              />
              {/* Overflowing Gold Coins & Emerald Gems */}
              <circle cx="34" cy="48" r="6" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
              <circle cx="45" cy="44" r="6.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1.2" />
              <circle cx="57" cy="45" r="6.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
              <circle cx="67" cy="49" r="5.5" fill="#eab308" stroke="#a16207" strokeWidth="1.2" />
              <polygon points="50,35 55,43 50,49 45,43" fill="#10b981" stroke="#a7f3d0" strokeWidth="1" />
              {/* Chest Base */}
              <rect
                x="16"
                y="50"
                width="68"
                height="34"
                rx="5"
                fill="#4a260f"
                stroke={`url(#chestGold-${pathIndex})`}
                strokeWidth="3"
              />
              {/* Brass Bands & Lockplate */}
              <line x1="34" y1="50" x2="34" y2="84" stroke="#eab308" strokeWidth="3" />
              <line x1="66" y1="50" x2="66" y2="84" stroke="#eab308" strokeWidth="3" />
              <rect x="44" y="54" width="12" height="14" rx="2" fill="#facc15" stroke="#713f12" strokeWidth="1.5" />
              <circle cx="50" cy="61" r="2.2" fill="#451a03" />
            </svg>
            {isSelected && (
              <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 right-0" />
            )}
          </div>
        ) : (
          /* Revealed Ancient Trap Chamber */
          <div className="relative w-16 h-20 sm:w-24 sm:h-28 flex items-center justify-center">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-rose-950/90 border-2 border-rose-500/70 flex flex-col items-center justify-center shadow-[0_0_24px_rgba(244,63,94,0.45)]">
              <Skull className="w-7 h-7 sm:w-10 sm:h-10 text-rose-400" />
              <div className="flex items-center gap-0.5 mt-1" aria-hidden="true">
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-rose-400" />
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-rose-400" />
                <span className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-rose-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action / Status Caption */}
      <div className="w-full min-w-0">
        {!isRevealed ? (
          <div className="text-[10px] sm:text-xs font-semibold text-amber-200/90 group-hover:text-amber-300 transition-colors flex items-center justify-center gap-1 truncate">
            {isIdlePreview ? (
              <>
                <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="text-slate-400 truncate">Sealed</span>
              </>
            ) : (
              <span className="truncate">Open Door</span>
            )}
          </div>
        ) : isSafe ? (
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-xs font-bold text-emerald-300 truncate">
              {isSelected ? 'Treasure Found' : 'Safe Path'}
            </div>
            <div className="text-[9px] sm:text-[11px] text-amber-200/80 truncate">
              {relicName}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[10px] sm:text-xs font-bold text-rose-400 truncate">
              {isSelected ? 'Trap Triggered' : 'Hidden Trap'}
            </div>
            <div className="text-[9px] sm:text-[11px] text-rose-200/75 truncate">
              {trapName}
            </div>
          </div>
        )}
      </div>
    </button>
  );
};
