import React from 'react';
import { getBingoBallColor, BINGO_TOTAL_BALLS } from './bingoMath';
import { Sparkles } from 'lucide-react';

interface BingoMachineProps {
  latestBall: number | null;
  recentBalls: number[];
  callsMade: number;
  isDrawingActive: boolean;
  isBallOnTicket: boolean;
  isRolling: boolean;
}

const DRUM_DECOR_BALLS = [
  { cx: 42, cy: 40, fill: '#dc2626' },
  { cx: 56, cy: 36, fill: '#2563eb' },
  { cx: 64, cy: 50, fill: '#16a34a' },
  { cx: 48, cy: 58, fill: '#d97706' },
  { cx: 36, cy: 54, fill: '#9333ea' },
  { cx: 54, cy: 47, fill: '#db2777' },
  { cx: 45, cy: 48, fill: '#0d9488' },
];

export const BingoMachine: React.FC<BingoMachineProps> = ({
  latestBall,
  recentBalls,
  callsMade,
  isDrawingActive,
  isBallOnTicket,
  isRolling,
}) => {
  const palette = latestBall !== null ? getBingoBallColor(latestBall) : null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-[#0e162b] via-[#0a1020] to-[#120f1e] p-3.5 shadow-xl sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Rotating Brass Drum + Chute */}
        <div className="flex items-center justify-center gap-3 sm:justify-start sm:gap-4">
          {/* Rotating 90-ball Brass Cage */}
          <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
            <svg
              viewBox="0 0 100 100"
              className="h-full w-full drop-shadow-[0_4px_12px_rgba(245,158,11,0.28)]"
              aria-hidden="true"
            >
              {/* Stand Base */}
              <path
                d="M22 90 L78 90 L72 82 L28 82 Z"
                fill="#78350f"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <path d="M32 82 L38 56 M68 82 L62 56" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />

              {/* Rotating Cage & Inner Tumbling Balls */}
              <g
                className={isDrawingActive || isRolling ? 'animate-bingo-drum' : ''}
                style={{ transformOrigin: '50px 48px' }}
              >
                <circle
                  cx="50"
                  cy="48"
                  r="29"
                  fill="#0b1325"
                  stroke="#fbbf24"
                  strokeWidth="2.8"
                />
                {/* Wire Meridians */}
                <ellipse
                  cx="50"
                  cy="48"
                  rx="29"
                  ry="11"
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity="0.4"
                  strokeWidth="1.3"
                />
                <ellipse
                  cx="50"
                  cy="48"
                  rx="11"
                  ry="29"
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity="0.4"
                  strokeWidth="1.3"
                />
                <line
                  x1="21"
                  y1="48"
                  x2="79"
                  y2="48"
                  stroke="#f59e0b"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                />

                {/* Colorful Tumbling Balls inside Cage */}
                {DRUM_DECOR_BALLS.map((b, i) => (
                  <g key={i}>
                    <circle cx={b.cx} cy={b.cy} r="5.2" fill={b.fill} />
                    <circle cx={b.cx - 1.5} cy={b.cy - 1.5} r="1.4" fill="#ffffff" fillOpacity="0.55" />
                  </g>
                ))}
              </g>

              {/* Center Brass Hub */}
              <circle cx="50" cy="48" r="4.5" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Active Drawn Ball & Chute Display */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-500/35 bg-slate-950/90 shadow-inner sm:h-20 sm:w-20">
              {latestBall !== null && palette ? (
                <div
                  key={`${latestBall}-${callsMade}`}
                  className="animate-bingo-ball-roll relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg sm:h-15 sm:w-15"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${palette.ring}, ${palette.bg} 62%, #090d16 100%)`,
                    boxShadow: isBallOnTicket
                      ? `0 0 20px rgba(251, 191, 36, 0.75)`
                      : `0 4px 12px rgba(0,0,0,0.6)`,
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-lg font-black tabular-nums text-slate-950 shadow-inner sm:h-10 sm:w-10 sm:text-xl">
                    {latestBall}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-lg font-black text-amber-400/50">—</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    Ready
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90 tabular-nums">
                Call {callsMade} / {BINGO_TOTAL_BALLS}
              </div>
              <div className="mt-0.5 text-sm font-black text-white sm:text-base">
                {latestBall !== null ? `Ball #${latestBall}` : '90-Ball Caller'}
              </div>
              {latestBall !== null && isBallOnTicket ? (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Ticket Match!
                </div>
              ) : (
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {palette ? `Column ${palette.decadeLabel}` : 'Draw to begin'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent Balls Trail */}
        <div className="flex flex-col items-center border-t border-slate-800/80 pt-2.5 sm:items-end sm:border-t-0 sm:pt-0">
          <span className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Recent Calls
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
            {recentBalls.length === 0 ? (
              <span className="text-xs text-slate-500">No balls called yet</span>
            ) : (
              recentBalls.map((ball, idx) => {
                const c = getBingoBallColor(ball);
                return (
                  <div
                    key={`${ball}-${idx}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black tabular-nums text-white shadow ${
                      idx === 0 ? 'ring-2 ring-amber-300 scale-105' : 'opacity-85'
                    }`}
                    style={{ backgroundColor: c.bg }}
                    title={`Ball ${ball}`}
                  >
                    {ball}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
