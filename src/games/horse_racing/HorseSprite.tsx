import React from 'react';
import { HorseRunner } from '../../types';

interface HorseSpriteProps {
  runner: HorseRunner;
  isRunning: boolean;
  isWinner?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Custom animated SVG thoroughbred racehorse & jockey sprite.
 * Distinct coat color, mane, primary/secondary jockey silks, saddle cloth with horse number,
 * articulating front & hind legs, and turf dust particles while running.
 */
export const HorseSprite: React.FC<HorseSpriteProps> = ({
  runner,
  isRunning,
  isWinner = false,
  isSelected = false,
  size = 'md',
}) => {
  const dims = size === 'sm' ? 'w-12 h-8 sm:w-16 sm:h-10' : 'w-14 h-9 sm:w-20 sm:h-12';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${dims} ${
        isRunning ? 'animate-horse-gallop' : ''
      }`}
    >
      {/* Winner aura */}
      {isWinner && (
        <div className="absolute -inset-1 rounded-full bg-amber-400/30 blur-md pointer-events-none" />
      )}

      {/* Subtle turf dust puffs behind hooves while running */}
      {isRunning && (
        <div className="absolute -left-2 bottom-0.5 flex gap-0.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200/50 animate-horse-dust" />
          <span
            className="w-1 h-1 rounded-full bg-amber-200/40 animate-horse-dust"
            style={{ animationDelay: '0.16s' }}
          />
        </div>
      )}

      <svg
        viewBox="0 0 76 46"
        className={`w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] ${
          isSelected ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.85)]' : ''
        }`}
        aria-label={`Horse ${runner.number} ${runner.name}`}
      >
        {/* Flowing tail */}
        <path
          d="M15 21 Q6 19 3 26 Q8 26 14 24 Z"
          fill={runner.maneColor}
        />

        {/* Back hind leg (far) */}
        <g
          className={isRunning ? 'animate-horse-leg-back' : ''}
          style={isRunning ? { animationDelay: '-0.12s' } : undefined}
        >
          <path
            d="M20 26 L15 36 L11 41"
            stroke={runner.maneColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Front leg (far) */}
        <g
          className={isRunning ? 'animate-horse-leg-front' : ''}
          style={isRunning ? { animationDelay: '-0.12s' } : undefined}
        >
          <path
            d="M46 25 L52 35 L58 39"
            stroke={runner.maneColor}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Horse torso */}
        <ellipse cx="34" cy="23" rx="18" ry="8" fill={runner.coatColor} />

        {/* Horse neck & head */}
        <path
          d="M46 19 L58 10 L68 13 L66 17 L57 16 L51 25 Z"
          fill={runner.coatColor}
        />
        {/* Mane */}
        <path
          d="M46 17 Q52 11 58 9 L55 13 Q50 15 47 19 Z"
          fill={runner.maneColor}
        />
        {/* Ear */}
        <polygon points="58,10 60,6 62,10" fill={runner.coatColor} />
        {/* Bridle & eye */}
        <circle cx="62" cy="12.5" r="0.9" fill="#ffffff" />
        <line x1="65" y1="15.5" x2="47" y2="14" stroke="#f59e0b" strokeWidth="0.9" />

        {/* Near hind leg */}
        <g className={isRunning ? 'animate-horse-leg-back' : ''}>
          <path
            d="M21 26 L17 36 L14 42"
            stroke={runner.coatColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="14" cy="42.2" r="1.6" fill="#0f172a" />
        </g>

        {/* Near front leg */}
        <g className={isRunning ? 'animate-horse-leg-front' : ''}>
          <path
            d="M47 25 L54 34 L61 38"
            stroke={runner.coatColor}
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="61.2" cy="38.2" r="1.6" fill="#0f172a" />
        </g>

        {/* Saddle cloth with runner number */}
        <rect
          x="26"
          y="16.5"
          width="14"
          height="11.5"
          rx="2.5"
          fill="#f8fafc"
          stroke={runner.silkPrimary}
          strokeWidth="1.5"
        />
        <text
          x="33"
          y="25.2"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="900"
          fill="#0f172a"
          fontFamily="monospace"
        >
          {runner.number}
        </text>

        {/* Jockey crouched forward in vibrant silks */}
        <path
          d="M32 17 Q37 9 45 10 L46 15 L36 18 Z"
          fill={runner.silkPrimary}
        />
        {/* Jockey stripe */}
        <path d="M36 12 L42 11 L41 15 L35 16 Z" fill={runner.silkSecondary} />
        {/* Jockey helmet */}
        <circle cx="46.5" cy="9.2" r="3.4" fill={runner.silkPrimary} stroke={runner.silkSecondary} strokeWidth="1" />
        {/* Helmet visor */}
        <path d="M49 9.5 L52 10.5" stroke="#0f172a" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
};
