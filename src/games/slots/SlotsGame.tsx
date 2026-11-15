import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../../types';
import { soundManager } from '../../services/sound';
import { storageManager } from '../../services/storage';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import { ArrowLeft, BookOpen, RotateCcw, Sparkles, Zap, Crown } from 'lucide-react';

interface SlotsGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface SymbolDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  payout3: number;
  payout4: number;
  payout5: number;
  isWild?: boolean;
  isScatter?: boolean;
}

const SLOT_SYMBOLS: SymbolDef[] = [
  { id: 'crown', name: 'Royal Crown', icon: '👑', color: '#fde047', payout3: 50, payout4: 200, payout5: 1000, isWild: true },
  { id: 'scatter', name: 'Scatter Star', icon: '⭐', color: '#eab308', payout3: 20, payout4: 100, payout5: 500, isScatter: true },
  { id: 'seven', name: 'Lucky 7', icon: '7️⃣', color: '#ef4444', payout3: 30, payout4: 150, payout5: 600 },
  { id: 'diamond', name: 'Diamond', icon: '💎', color: '#38bdf8', payout3: 25, payout4: 100, payout5: 400 },
  { id: 'bell', name: 'Gold Bell', icon: '🔔', color: '#facc15', payout3: 20, payout4: 80, payout5: 300 },
  { id: 'bar', name: 'Golden Bar', icon: '🍫', color: '#ca8a04', payout3: 15, payout4: 60, payout5: 200 },
  { id: 'horseshoe', name: 'Horseshoe', icon: '🧲', color: '#a855f7', payout3: 10, payout4: 40, payout5: 150 },
  { id: 'cherry', name: 'Cherry', icon: '🍒', color: '#f43f5e', payout3: 5, payout4: 20, payout5: 100 },
];

// Pre-generated continuous strip of symbols for each reel rolling animation
const ROLLING_STRIP: string[] = [
  'seven', 'bell', 'cherry', 'diamond', 'crown', 'bar', 'horseshoe', 'scatter',
  'seven', 'cherry', 'bell', 'crown', 'diamond', 'bar', 'horseshoe', 'seven'
];

export const SlotsGame: React.FC<SlotsGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  // 5 reels with 3 rows visible
  const [reels, setReels] = useState<string[][]>([
    ['seven', 'bell', 'cherry'],
    ['crown', 'diamond', 'bar'],
    ['seven', 'cherry', 'bell'],
    ['diamond', 'bar', 'seven'],
    ['bell', 'cherry', 'horseshoe'],
  ]);

  const [betPerLine, setBetPerLine] = useState<number>(5);
  const [activeLines] = useState<number>(20);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [reelSpinningState, setReelSpinningState] = useState<boolean[]>([false, false, false, false, false]);
  const [reelBouncingState, setReelBouncingState] = useState<boolean[]>([false, false, false, false, false]);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState<number>(0);
  const [roundResult, setRoundResult] = useState<string | null>(null);
  const [winningLines, setWinningLines] = useState<number[]>([]);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  const spinTimersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      spinTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  const totalWager = freeSpinsLeft > 0 ? 0 : betPerLine * activeLines;

  const spin = () => {
    if (isSpinning) return;
    if (freeSpinsLeft === 0 && (totalWager <= 0 || totalWager > profile.coins)) return;

    // Clear previous timers
    spinTimersRef.current.forEach(clearTimeout);
    spinTimersRef.current = [];

    if (freeSpinsLeft === 0) {
      const tx = storageManager.executeTransaction('bet', 'slots', totalWager, `Royal Slots Spin: ${totalWager} coins`);
      if (!tx.success) return;
      onUpdateProfile();
    } else {
      setFreeSpinsLeft(prev => prev - 1);
    }

    // Sound and initial spinning state
    soundManager.playReelTick();
    setIsSpinning(true);
    setRoundResult(null);
    setWinningLines([]);
    setReelSpinningState([true, true, true, true, true]);
    setReelBouncingState([false, false, false, false, false]);

    // Pre-determine final outcome for each of the 5 reels
    const finalReelsOutcome: string[][] = [];
    for (let r = 0; r < 5; r++) {
      const reelCol: string[] = [];
      for (let row = 0; row < 3; row++) {
        const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
        reelCol.push(sym.id);
      }
      finalReelsOutcome.push(reelCol);
    }

    // Play periodic reel ticking sounds during spin
    const tickInterval = setInterval(() => {
      soundManager.playReelTick();
    }, 140);

    // Staggered stop times for each of the 5 reels
    const stopDelays = [650, 950, 1250, 1550, 1850];

    stopDelays.forEach((delay, reelIdx) => {
      const timer = setTimeout(() => {
        soundManager.playReelStop();

        // Update single reel result
        setReels(prev => {
          const next = [...prev];
          next[reelIdx] = finalReelsOutcome[reelIdx];
          return next;
        });

        // Reel stops spinning and bounces into place
        setReelSpinningState(prev => {
          const next = [...prev];
          next[reelIdx] = false;
          return next;
        });

        setReelBouncingState(prev => {
          const next = [...prev];
          next[reelIdx] = true;
          return next;
        });

        // Clear bounce after animation finishes
        setTimeout(() => {
          setReelBouncingState(prev => {
            const next = [...prev];
            next[reelIdx] = false;
            return next;
          });
        }, 380);
      }, delay);

      spinTimersRef.current.push(timer);
    });

    // Final evaluation after all reels come to complete rest
    const finalTimer = setTimeout(() => {
      clearInterval(tickInterval);
      evaluateSpin(finalReelsOutcome);
      setIsSpinning(false);
    }, 2050);

    spinTimersRef.current.push(finalTimer);
  };

  const evaluateSpin = (finalReels: string[][]) => {
    let totalWon = 0;
    const hitLines: number[] = [];

    // Check Row 0 (Top line), Row 1 (Center line), Row 2 (Bottom line)
    for (let row = 0; row < 3; row++) {
      const lineSymbols = [
        finalReels[0][row],
        finalReels[1][row],
        finalReels[2][row],
        finalReels[3][row],
        finalReels[4][row],
      ];

      const firstSymId = lineSymbols[0];
      const firstDef = SLOT_SYMBOLS.find(s => s.id === firstSymId)!;

      // Count consecutive matches
      let matchCount = 1;
      for (let i = 1; i < 5; i++) {
        const curId = lineSymbols[i];
        if (curId === firstSymId || curId === 'crown' || firstSymId === 'crown') {
          matchCount++;
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        hitLines.push(row + 1);
        let multiplier = firstDef.payout3;
        if (matchCount === 4) multiplier = firstDef.payout4;
        if (matchCount === 5) {
          multiplier = firstDef.payout5;
          storageManager.updateAchievementProgress('slots_big_win', 1);
        }

        const lineWin = betPerLine * multiplier * (freeSpinsLeft > 0 ? 2 : 1);
        totalWon += lineWin;
      }
    }

    // Count scatters across the entire board
    let scatterCount = 0;
    finalReels.forEach(col => {
      col.forEach(s => {
        if (s === 'scatter') scatterCount++;
      });
    });

    if (scatterCount >= 3) {
      const freeSpinsAwarded = 10;
      setFreeSpinsLeft(prev => prev + freeSpinsAwarded);
      soundManager.playBigWin();
      setCelebrateWin(true);
      setRoundResult(`⭐ ${scatterCount} SCATTERS HIT! Awarded 10 FREE SPINS with 2X MULTIPLIER!`);
    } else if (totalWon > 0) {
      storageManager.executeTransaction('win', 'slots', totalWon, `Royal Slots Win: +${totalWon}`);
      soundManager.playWin();
      setCelebrateWin(true);
      setWinningLines(hitLines);
      setRoundResult(`WINNER! Hit ${hitLines.length} payline(s) for +${totalWon.toLocaleString()} coins!`);
      storageManager.recordGameRound('slots', true, totalWon);
    } else {
      setRoundResult(freeSpinsLeft > 0 ? 'Free Spin completed.' : 'No match this spin.');
      storageManager.recordGameRound('slots', false);
    }

    onUpdateProfile();
  };

  const getSymbolDef = (id: string) => SLOT_SYMBOLS.find(s => s.id === id) || SLOT_SYMBOLS[0];

  return (
    <div className="relative min-h-[calc(100vh-65px)] flex flex-col justify-between overflow-x-hidden bg-[#0d0e14]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      {/* In-Game Rule Drawer */}
      <InGameRuleDrawer
        gameId="slots"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Header Bar */}
      <div className="w-full bg-[#12141f]/95 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-slate-200 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onBackToLobby();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <div className="flex flex-col">
            <span className="font-serif font-black tracking-wider text-amber-300 uppercase">Royal Ace Slots</span>
            <span className="text-[10px] text-slate-400">5 Reels · 20 Paylines · Wilds & Scatters</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {freeSpinsLeft > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold text-xs animate-pulse flex items-center gap-1 shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{freeSpinsLeft} Free Spins (2x)!</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setShowRulesDrawer(true);
            }}
            className="p-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* Slot Machine Housing & Reels */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-5 select-none relative">
        <div className="w-full max-w-2xl bg-gradient-to-b from-[#251b10] via-[#151218] to-[#0c0d12] border-4 border-amber-500/70 rounded-3xl p-3 sm:p-5 shadow-2xl relative overflow-hidden">
          {/* Top Marquee */}
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/30 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-lg sm:text-xl font-black">★</span>
              <span className="font-serif font-black tracking-widest text-amber-300 text-sm sm:text-base uppercase">
                ROYAL JACKPOT
              </span>
            </div>
            <div className="font-mono text-amber-400 font-bold text-xs sm:text-sm bg-black/60 px-3 py-1 rounded-lg border border-amber-500/30 tabular-nums">
              500,000 VIRTUAL CREDITS
            </div>
          </div>

          {/* 5-Reel Grid Window Frame */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 bg-black/95 p-2 sm:p-3 rounded-2xl border-2 border-amber-500/50 shadow-inner overflow-hidden relative">
            {/* Payline Guides on sides */}
            <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-around text-[9px] font-mono text-amber-400/50 pointer-events-none select-none z-20">
              <span>L1</span>
              <span>L2</span>
              <span>L3</span>
            </div>
            <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-around text-[9px] font-mono text-amber-400/50 pointer-events-none select-none z-20">
              <span>L1</span>
              <span>L2</span>
              <span>L3</span>
            </div>

            {reels.map((col, cIdx) => {
              const isColSpinning = reelSpinningState[cIdx];
              const isColBouncing = reelBouncingState[cIdx];

              return (
                <div
                  key={cIdx}
                  className="relative h-[216px] sm:h-[240px] bg-gradient-to-b from-[#181b24] via-[#0f1118] to-[#181b24] rounded-xl border border-slate-700/60 overflow-hidden shadow-inner flex flex-col justify-center"
                >
                  {/* Glass Reflection Highlight */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/30 pointer-events-none z-10" />

                  {isColSpinning ? (
                    /* Rolling Reel Strip Animation */
                    <div className="w-full flex flex-col items-center animate-reel-rolling filter blur-[0.4px]">
                      {ROLLING_STRIP.map((symId, sIdx) => {
                        const sym = getSymbolDef(symId);
                        return (
                          <div
                            key={sIdx}
                            className="h-[72px] sm:h-[80px] w-full flex flex-col items-center justify-center p-1 border-b border-slate-800/40"
                          >
                            <span className="text-3xl sm:text-4xl filter drop-shadow">{sym.icon}</span>
                            <span className="text-[8px] font-semibold tracking-tight text-slate-400 mt-0.5 truncate max-w-full">
                              {sym.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Stopped Reel State with slight mechanical bounce */
                    <div
                      className={`w-full flex flex-col items-center justify-around h-full py-1 ${
                        isColBouncing ? 'animate-reel-stop' : ''
                      }`}
                    >
                      {col.map((symId, rIdx) => {
                        const sym = getSymbolDef(symId);
                        const isWinning = winningLines.includes(rIdx + 1);

                        return (
                          <div
                            key={rIdx}
                            className={`h-[68px] sm:h-[74px] w-[95%] bg-gradient-to-b from-[#1e222e] to-[#141620] border rounded-lg flex flex-col items-center justify-center p-1 relative shadow transition-all ${
                              isWinning
                                ? 'border-amber-400 ring-2 ring-amber-400/70 bg-amber-950/30'
                                : 'border-slate-700/60'
                            }`}
                          >
                            <span className="text-2xl sm:text-3xl filter drop-shadow">{sym.icon}</span>
                            <span className="text-[9px] font-semibold tracking-tight text-slate-300 mt-0.5 truncate max-w-full">
                              {sym.name}
                            </span>
                            {sym.isWild && (
                              <span className="absolute top-0.5 right-1 text-[8px] font-black text-amber-300 uppercase">
                                Wild
                              </span>
                            )}
                            {sym.isScatter && (
                              <span className="absolute top-0.5 right-1 text-[8px] font-black text-yellow-300 uppercase">
                                Scatter
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Result Banner */}
          <div className="mt-3 text-center min-h-[32px] flex items-center justify-center">
            {roundResult ? (
              <div className="font-serif font-bold text-amber-300 text-xs sm:text-sm bg-amber-950/40 border border-amber-500/40 px-4 py-1.5 rounded-xl shadow-lg animate-in zoom-in-95">
                {roundResult}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Match 3, 4 or 5 symbols on any active payline</div>
            )}
          </div>
        </div>
      </div>

      {/* Slot Machine Bet Controls */}
      <div className="w-full bg-[#111319]/95 border-t border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl backdrop-blur-md z-30">
        {/* Bet and Lines Configuration */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Bet per Line</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {[1, 5, 10, 25, 50].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setBetPerLine(amt);
                  }}
                  disabled={isSpinning}
                  className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                    betPerLine === amt
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col text-right sm:text-left">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Spin Wager</span>
            <span className="font-serif font-black text-amber-400 text-lg tabular-nums">
              {totalWager.toLocaleString()} coins
            </span>
          </div>
        </div>

        {/* Spin Button */}
        <button
          type="button"
          onClick={spin}
          disabled={isSpinning || (freeSpinsLeft === 0 && totalWager > profile.coins)}
          className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 text-slate-950 font-serif font-black text-base tracking-widest uppercase shadow-xl shadow-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5 text-slate-950" />
          <span>{isSpinning ? 'ROLLING...' : freeSpinsLeft > 0 ? 'FREE SPIN' : 'SPIN REELS'}</span>
        </button>
      </div>
    </div>
  );
};
