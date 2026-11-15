import React from 'react';
import { Card, Suit } from '../../types';
import { SUIT_COLORS, SUIT_SYMBOLS } from '../../utils/cards';

interface PlayingCardProps {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
  isHighlighted?: boolean;
  className?: string;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  size = 'md',
  isHighlighted = false,
  className = '',
}) => {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const color = isRed ? '#dc2626' : '#0f172a';
  const symbol = SUIT_SYMBOLS[card.suit];

  const sizeClasses = {
    sm: 'w-10 h-14 text-xs rounded',
    md: 'w-14 h-20 sm:w-16 sm:h-24 text-sm sm:text-base rounded-md',
    lg: 'w-16 h-24 sm:w-20 sm:h-28 text-base sm:text-lg rounded-lg',
  }[size];

  if (card.isHidden) {
    // Card Back - Luxury Royal Ace Lattice & Foil
    return (
      <div
        className={`${sizeClasses} bg-gradient-to-br from-[#6b1111] via-[#3a0606] to-[#1a0202] border border-amber-500/40 shadow-lg shadow-black/60 flex items-center justify-center relative overflow-hidden select-none shrink-0 transition-all duration-300 ${className}`}
      >
        <div className="absolute inset-1 border border-amber-400/30 rounded flex items-center justify-center bg-[#290404]/60">
          <div className="w-full h-full opacity-20 flex items-center justify-center">
            {/* Guilloche geometric lattice */}
            <svg viewBox="0 0 40 60" className="w-full h-full text-amber-300 fill-current">
              <pattern id="cardPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#cardPattern)" />
            </svg>
          </div>
          <div className="w-6 h-6 rounded-full border border-amber-400/50 flex items-center justify-center bg-black/40 z-10">
            <span className="font-serif text-[10px] font-bold text-amber-300">RA</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} bg-[#fdfdfd] border ${
        isHighlighted
          ? 'border-amber-400 ring-2 ring-amber-400/70 shadow-amber-500/30 -translate-y-1'
          : 'border-slate-300 shadow-md shadow-black/40'
      } relative flex flex-col justify-between p-1 select-none shrink-0 transition-transform duration-200 ${className}`}
      style={{ color }}
    >
      {/* Top Left Rank & Suit */}
      <div className="flex flex-col items-center leading-none">
        <span className="font-bold tracking-tighter">{card.rank}</span>
        <span className="text-[10px] leading-tight">{symbol}</span>
      </div>

      {/* Center Art */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {['J', 'Q', 'K'].includes(card.rank) ? (
          <div className="flex flex-col items-center opacity-85">
            <span className="text-xl sm:text-2xl font-serif font-black">{card.rank}</span>
            <span className="text-sm">{symbol}</span>
          </div>
        ) : card.rank === 'A' ? (
          <span className="text-2xl sm:text-3xl font-serif font-black opacity-90">{symbol}</span>
        ) : (
          <span className="text-lg sm:text-xl opacity-80">{symbol}</span>
        )}
      </div>

      {/* Bottom Right Rank & Suit (Upside down) */}
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className="font-bold tracking-tighter">{card.rank}</span>
        <span className="text-[10px] leading-tight">{symbol}</span>
      </div>
    </div>
  );
};
