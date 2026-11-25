import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  BingoPhase,
  BingoTicketGrid,
  BingoRoundResult,
} from '../../types';
import {
  BINGO_MIN_BET,
  BINGO_MAX_BET,
  BINGO_DEFAULT_BET,
  BINGO_TOTAL_BALLS,
  BINGO_MILESTONES,
  BINGO_MILESTONE_ORDER,
  calculateBingoMilestoneReward,
  calculateTotalBingoReward,
  calculateMaxBingoPotentialReward,
} from './bingoMath';
import {
  BINGO_COLUMN_RANGES,
  generateValidBingoTicket,
  generateBingoDrawSequence,
  extractTicketNumbers,
  evaluateBingoProgress,
  validateBingoBetAmount,
  loadBingoHistory,
  appendBingoHistoryRecord,
  calculateBingoStats,
} from './bingoLogic';
import { BingoMachine } from './BingoMachine';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Coins,
  History,
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Zap,
  FastForward,
  Award,
  RefreshCw,
  Grid3X3,
} from 'lucide-react';

interface BingoGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const BingoGame: React.FC<BingoGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  // --- Core Game State ---
  const [phase, setPhase] = useState<BingoPhase>('SETUP');
  const [bet, setBet] = useState<number>(BINGO_DEFAULT_BET);
  const [ticket, setTicket] = useState<BingoTicketGrid>(() => generateValidBingoTicket());
  const [drawSequence, setDrawSequence] = useState<number[]>([]);
  const [calledCount, setCalledCount] = useState<number>(0);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [lockedBet, setLockedBet] = useState<number>(BINGO_DEFAULT_BET);

  // --- Auto-Draw & Animation Controls ---
  const [isAutoDrawing, setIsAutoDrawing] = useState<boolean>(false);
  const [drawSpeed, setDrawSpeed] = useState<'normal' | 'fast'>('normal');
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [milestoneBanner, setMilestoneBanner] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [finishedRecord, setFinishedRecord] = useState<BingoRoundResult | null>(null);

  // --- Modals & History ---
  const [history, setHistory] = useState<BingoRoundResult[]>(() => loadBingoHistory());
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // --- Refs for Concurrency, Single Settlement & Timers ---
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const autoTimerRef = useRef<number | null>(null);
  const rollTimerRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const prevMilestonesRef = useRef<{ one: boolean; two: boolean; full: boolean }>({
    one: false,
    two: false,
    full: false,
  });
  const isMountedRef = useRef<boolean>(true);

  const stats = useMemo(() => calculateBingoStats(history), [history]);

  // Derived active ticket numbers & called balls
  const ticketNumbers = useMemo(() => extractTicketNumbers(ticket), [ticket]);
  const ticketNumberSet = useMemo(() => new Set(ticketNumbers), [ticketNumbers]);

  const calledBalls = useMemo(
    () => drawSequence.slice(0, calledCount),
    [drawSequence, calledCount]
  );
  const calledSet = useMemo(() => new Set(calledBalls), [calledBalls]);
  const latestBall = calledCount > 0 ? drawSequence[calledCount - 1] : null;
  const recentBalls = useMemo(
    () => calledBalls.slice(-5).reverse(),
    [calledBalls]
  );

  const activeBetForEval = phase === 'SETUP' ? bet : lockedBet;
  const evaluation = useMemo(
    () => evaluateBingoProgress(ticket, calledBalls, activeBetForEval),
    [ticket, calledBalls, activeBetForEval]
  );

  const currentEarnedReward = useMemo(
    () => calculateTotalBingoReward(evaluation.outcomes),
    [evaluation.outcomes]
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current);
      if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  // Pause auto-draw cleanly when tab becomes hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsAutoDrawing(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Trigger milestone SFX & celebratory toast exactly once per milestone
  useEffect(() => {
    if (phase !== 'DRAWING') return;

    const m1 = evaluation.outcomes[0].earned;
    const m2 = evaluation.outcomes[1].earned;
    const m3 = evaluation.outcomes[2].earned;

    let msg: string | null = null;
    if (m3 && !prevMilestonesRef.current.full) {
      prevMilestonesRef.current.full = true;
      soundManager.playBingoMilestone(3);
      msg = `FULL HOUSE! +${evaluation.outcomes[2].reward.toLocaleString()} coins locked!`;
    } else if (m2 && !prevMilestonesRef.current.two) {
      prevMilestonesRef.current.two = true;
      soundManager.playBingoMilestone(2);
      msg = `TWO LINES! +${evaluation.outcomes[1].reward.toLocaleString()} coins locked!`;
    } else if (m1 && !prevMilestonesRef.current.one) {
      prevMilestonesRef.current.one = true;
      soundManager.playBingoMilestone(1);
      msg = `ONE LINE! +${evaluation.outcomes[0].reward.toLocaleString()} coins locked!`;
    }

    if (msg) {
      setMilestoneBanner(msg);
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setMilestoneBanner(null);
      }, 2800);
    }
  }, [phase, evaluation.outcomes]);

  // Settle round atomically once Full House (15/15) or all 90 balls are called
  const settleBingoRound = useCallback(
    (roundId: string, finalCount: number) => {
      if (settledRoundIdsRef.current.has(roundId)) {
        return;
      }
      settledRoundIdsRef.current.add(roundId);
      setIsAutoDrawing(false);

      const finalBalls = drawSequence.slice(0, finalCount);
      const finalEval = evaluateBingoProgress(ticket, finalBalls, lockedBet);
      const totalReward = calculateTotalBingoReward(finalEval.outcomes);
      const net = totalReward - lockedBet;
      const isWin = totalReward > 0;

      if (isWin) {
        const hitLabels = finalEval.outcomes
          .filter(o => o.earned)
          .map(o => o.label)
          .join(' + ');

        storageManager.executeTransaction(
          'win',
          'bingo',
          totalReward,
          `Royal Bingo Win (${hitLabels}) in ${finalCount} calls`
        );

        if (finalEval.outcomes[0].earned || finalEval.outcomes[1].earned || finalEval.outcomes[2].earned) {
          storageManager.updateAchievementProgress('bingo_first_line', 1);
        }
        if (finalEval.outcomes[2].earned) {
          storageManager.updateAchievementProgress('bingo_full_house', 1);
        }

        soundManager.playWin();
        setShowCelebration(true);
        if (celebrationTimerRef.current !== null) {
          window.clearTimeout(celebrationTimerRef.current);
        }
        celebrationTimerRef.current = window.setTimeout(() => {
          if (isMountedRef.current) setShowCelebration(false);
        }, 3200);
      } else {
        soundManager.playLoss();
      }

      storageManager.recordGameRound('bingo', isWin, totalReward);
      onUpdateProfile();

      const record: BingoRoundResult = {
        id: roundId,
        timestamp: Date.now(),
        bet: lockedBet,
        ticketNumbers: extractTicketNumbers(ticket),
        totalCallsMade: finalCount,
        oneLine: {
          achievedAtCall: finalEval.outcomes[0].achievedAtCall,
          earned: finalEval.outcomes[0].earned,
          reward: finalEval.outcomes[0].reward,
        },
        twoLines: {
          achievedAtCall: finalEval.outcomes[1].achievedAtCall,
          earned: finalEval.outcomes[1].earned,
          reward: finalEval.outcomes[1].reward,
        },
        fullHouse: {
          achievedAtCall: finalEval.outcomes[2].achievedAtCall,
          earned: finalEval.outcomes[2].earned,
          reward: finalEval.outcomes[2].reward,
        },
        totalReward,
        net,
        isWin,
      };

      const updated = appendBingoHistoryRecord(record);
      setHistory(updated);
      setFinishedRecord(record);
      setPhase('FINISHED');
    },
    [drawSequence, ticket, lockedBet, onUpdateProfile]
  );

  // Draw a single next ball
  const drawNextBall = useCallback(() => {
    if (phase !== 'DRAWING' || !activeRoundId) return;
    if (calledCount >= BINGO_TOTAL_BALLS) return;

    const nextCount = calledCount + 1;
    const nextBall = drawSequence[calledCount];
    setCalledCount(nextCount);

    setIsRolling(true);
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    rollTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setIsRolling(false);
    }, 360);

    soundManager.playBingoBallPop(nextBall);
    if (ticketNumberSet.has(nextBall)) {
      soundManager.playBingoMark();
    }

    // Check if Full House is now complete or 90 balls reached
    const nextEval = evaluateBingoProgress(ticket, drawSequence.slice(0, nextCount), lockedBet);
    if (nextEval.totalMarkedCount === 15 || nextCount >= BINGO_TOTAL_BALLS) {
      settleBingoRound(activeRoundId, nextCount);
    }
  }, [
    phase,
    activeRoundId,
    calledCount,
    drawSequence,
    ticketNumberSet,
    ticket,
    lockedBet,
    settleBingoRound,
  ]);

  // Auto-draw scheduler
  useEffect(() => {
    if (phase !== 'DRAWING' || !isAutoDrawing) {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const delayMs = prefersReducedMotion ? 110 : drawSpeed === 'fast' ? 230 : 680;
    autoTimerRef.current = window.setTimeout(() => {
      drawNextBall();
    }, delayMs);

    return () => {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [phase, isAutoDrawing, drawSpeed, calledCount, drawNextBall]);

  // --- User Actions ---
  const handleBetChange = (val: number) => {
    if (phase !== 'SETUP') return;
    const clamped = Math.max(0, Math.min(BINGO_MAX_BET, Math.floor(val)));
    setBet(clamped);
    setErrorMessage(null);
  };

  const handleGenerateNewTicket = () => {
    if (phase !== 'SETUP') return;
    soundManager.playButtonClick();
    setTicket(generateValidBingoTicket());
    setErrorMessage(null);
  };

  const handleQuickReload = () => {
    const res = storageManager.claimEmergencyReload();
    if (res.success) {
      soundManager.playWin();
      onUpdateProfile();
      setErrorMessage(null);
    } else {
      setErrorMessage(res.message);
    }
  };

  const handleStartBingo = () => {
    if (phase !== 'SETUP') return;

    const check = validateBingoBetAmount(bet, profile.coins);
    if (!check.valid) {
      setErrorMessage(check.error || 'Invalid Bingo ticket wager.');
      soundManager.playButtonClick();
      return;
    }

    // Deduct wager ONCE before draw begins
    const tx = storageManager.executeTransaction(
      'bet',
      'bingo',
      bet,
      `Royal Bingo 90-Ball Ticket (${bet.toLocaleString()} coins)`
    );
    if (!tx.success) {
      setErrorMessage(tx.error || 'Unable to purchase Bingo ticket.');
      return;
    }
    onUpdateProfile();

    const roundId = `bingo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sequence = generateBingoDrawSequence();

    prevMilestonesRef.current = { one: false, two: false, full: false };
    setActiveRoundId(roundId);
    setLockedBet(bet);
    setDrawSequence(sequence);
    setCalledCount(0);
    setFinishedRecord(null);
    setMilestoneBanner(null);
    setShowCelebration(false);
    setErrorMessage(null);
    setPhase('DRAWING');
    setIsAutoDrawing(true); // Smoothly begin auto-drawing (player can pause/switch to manual anytime)
    soundManager.playButtonClick();
  };

  const handleInstantFinish = () => {
    if (phase !== 'DRAWING' || !activeRoundId) return;
    setIsAutoDrawing(false);

    // Advance cleanly to the exact ball that completes Full House (or call 90)
    const fullEval = evaluateBingoProgress(ticket, drawSequence, lockedBet);
    const stopAt = fullEval.fullHouseCall ?? BINGO_TOTAL_BALLS;
    setCalledCount(stopAt);
    settleBingoRound(activeRoundId, stopAt);
  };

  const handlePlayAgain = () => {
    soundManager.playButtonClick();
    setIsAutoDrawing(false);
    setPhase('SETUP');
    setTicket(generateValidBingoTicket());
    setDrawSequence([]);
    setCalledCount(0);
    setActiveRoundId(null);
    setFinishedRecord(null);
    setMilestoneBanner(null);
    setShowCelebration(false);
    setErrorMessage(null);
  };

  const maxPotentialReward = useMemo(
    () => calculateMaxBingoPotentialReward(activeBetForEval),
    [activeBetForEval]
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-slate-100 pb-10">
      <CoinCelebration active={showCelebration} />

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-[#080d1c]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToLobby}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300 sm:px-3 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Exit</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Grid3X3 className="h-4 w-4 shrink-0 text-amber-400" />
                <h1 className="truncate text-sm font-black tracking-wide text-amber-300 sm:text-lg">
                  ROYAL BINGO
                </h1>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                90-Ball Challenge · 3×9 Official Ticket · 95% RTP
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 tabular-nums sm:px-3 sm:text-sm">
              <Coins className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{profile.coins.toLocaleString()}</span>
            </div>

            {profile.coins < 50 && phase !== 'DRAWING' && (
              <button
                type="button"
                onClick={handleQuickReload}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
                title="VIP Courtesy Reload (+1,000 coins)"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">+1K</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setIsHistoryOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300"
              aria-label="Bingo History and Statistics"
            >
              <History className="h-4 w-4" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setIsRulesOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/90 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-amber-300"
              aria-label="Bingo Rules"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">Rules</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="mx-auto mt-3 grid max-w-7xl grid-cols-1 gap-4 px-3 sm:mt-5 sm:gap-5 sm:px-5 lg:grid-cols-12">
        {/* LEFT / PRIMARY STAGE: BINGO MACHINE + OFFICIAL 3x9 TICKET + MILESTONES */}
        <section className="min-w-0 space-y-4 lg:col-span-7">
          {/* Animated 90-Ball Machine & Chute */}
          <BingoMachine
            latestBall={latestBall}
            recentBalls={recentBalls}
            callsMade={calledCount}
            isDrawingActive={phase === 'DRAWING' && isAutoDrawing}
            isBallOnTicket={latestBall !== null && ticketNumberSet.has(latestBall)}
            isRolling={isRolling}
          />

          {/* Milestone Toast Notification */}
          {milestoneBanner && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-amber-500/20 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-amber-200 shadow-lg sm:text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{milestoneBanner}</span>
            </div>
          )}

          {/* Active Draw Controls (only in DRAWING phase) */}
          {phase === 'DRAWING' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0b1325] p-2.5 sm:p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoDrawing(false);
                    drawNextBall();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-950 shadow transition hover:brightness-110"
                >
                  <Zap className="h-3.5 w-3.5 fill-slate-950" />
                  Draw Next Ball
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setIsAutoDrawing(prev => !prev);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                    isAutoDrawing
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                      : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {isAutoDrawing ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause Auto
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Resume Auto
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setDrawSpeed(s => (s === 'normal' ? 'fast' : 'normal'));
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50"
                >
                  <span>Speed: {drawSpeed === 'fast' ? 'Fast' : 'Normal'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleInstantFinish}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-2 text-xs font-semibold text-slate-300 hover:border-amber-400/50 hover:text-amber-200"
                title="Complete remaining draws immediately"
              >
                <FastForward className="h-3.5 w-3.5" />
                <span>Finish Draw</span>
              </button>
            </div>
          )}

          {/* OFFICIAL 3x9 ROYAL BINGO TICKET */}
          <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-b from-[#111930] to-[#0a1020] p-3 shadow-2xl sm:p-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-amber-300 sm:text-sm">
                  Official 90-Ball Ticket
                </h2>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  Marked {evaluation.totalMarkedCount} / 15 numbers · Lines Completed:{' '}
                  <span className="font-bold text-emerald-400">
                    {evaluation.completedLinesCount} / 3
                  </span>
                </p>
              </div>

              {phase === 'SETUP' ? (
                <button
                  type="button"
                  onClick={handleGenerateNewTicket}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  New Ticket
                </button>
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300 tabular-nums">
                  Locked Winnings: {currentEarnedReward.toLocaleString()}
                </div>
              )}
            </div>

            {/* Column Range Headers (1-9 ... 80-90) */}
            <div className="mb-1 grid grid-cols-9 gap-1 sm:gap-1.5 text-center">
              {BINGO_COLUMN_RANGES.map(([minVal, maxVal], colIdx) => (
                <div
                  key={colIdx}
                  className="text-[9px] font-bold text-slate-500 tabular-nums sm:text-[10px]"
                >
                  {minVal}–{maxVal}
                </div>
              ))}
            </div>

            {/* 3 Rows x 9 Columns Ticket Grid */}
            <div className="space-y-1.5">
              {ticket.map((row, rowIdx) => {
                const rowComplete = evaluation.completedRows[rowIdx];
                const rowCount = evaluation.rowMarkedCounts[rowIdx];

                return (
                  <div
                    key={rowIdx}
                    className={`rounded-xl border p-1 transition sm:p-1.5 ${
                      rowComplete
                        ? 'border-emerald-400/70 bg-emerald-500/15 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
                        : 'border-slate-800/90 bg-slate-950/60'
                    }`}
                  >
                    <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
                      {row.map((cell, colIdx) => {
                        if (cell === null) {
                          return (
                            <div
                              key={colIdx}
                              className="flex h-9 items-center justify-center rounded-md border border-slate-800/50 bg-slate-900/40 sm:h-12 md:h-14"
                              aria-hidden="true"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-800" />
                            </div>
                          );
                        }

                        const isMarked = calledSet.has(cell);
                        const isJustCalled = latestBall === cell;

                        return (
                          <div
                            key={colIdx}
                            className={`relative flex h-9 items-center justify-center rounded-md border font-black tabular-nums transition sm:h-12 md:h-14 ${
                              isMarked
                                ? rowComplete
                                  ? 'border-emerald-300 bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 shadow-md'
                                  : 'border-amber-300 bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 shadow-md'
                                : 'border-slate-700/80 bg-[#15203a] text-slate-100'
                            } ${isJustCalled ? 'animate-bingo-mark-pop ring-2 ring-white' : ''}`}
                          >
                            <span className="text-[11px] sm:text-base md:text-lg">{cell}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Subtle row progress bar */}
                    <div className="mt-1 flex items-center justify-between px-1 text-[10px]">
                      <span className="font-semibold text-slate-400">Row {rowIdx + 1}</span>
                      <span
                        className={`font-bold tabular-nums ${
                          rowComplete ? 'text-emerald-300' : 'text-slate-400'
                        }`}
                      >
                        {rowComplete ? 'LINE COMPLETE!' : `${rowCount} / 5 marked`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 MILESTONE CHALLENGE CARDS */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {BINGO_MILESTONE_ORDER.map((id, idx) => {
              const cfg = BINGO_MILESTONES[id];
              const outcome = evaluation.outcomes[idx];
              const potentialReward = calculateBingoMilestoneReward(activeBetForEval, cfg.multiplier);
              const callsRemaining = Math.max(0, cfg.targetCalls - calledCount);
              const missedTarget =
                phase !== 'SETUP' && !outcome.earned && calledCount >= cfg.targetCalls;

              return (
                <div
                  key={id}
                  className={`rounded-xl border p-3 transition ${
                    outcome.earned
                      ? 'border-emerald-400/70 bg-emerald-500/15 shadow-md'
                      : missedTarget
                      ? 'border-slate-800 bg-slate-950/60 opacity-65'
                      : 'border-amber-500/25 bg-[#0b1325]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black uppercase tracking-wide text-amber-300">
                      {cfg.label}
                    </span>
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-black tabular-nums text-amber-200">
                      {cfg.multiplier.toFixed(1)}x
                    </span>
                  </div>

                  <div className="mt-1 text-base font-black tabular-nums text-white">
                    +{potentialReward.toLocaleString()}{' '}
                    <span className="text-[11px] font-semibold text-slate-400">coins</span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 tabular-nums">Target ≤ {cfg.targetCalls}</span>
                    {outcome.earned ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Hit #{outcome.achievedAtCall}
                      </span>
                    ) : missedTarget ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                        <XCircle className="h-3.5 w-3.5" />
                        {outcome.achievedAtCall ? `Late (#${outcome.achievedAtCall})` : 'Missed'}
                      </span>
                    ) : phase === 'DRAWING' ? (
                      <span className="font-semibold text-sky-300 tabular-nums">
                        {callsRemaining} left
                      </span>
                    ) : (
                      <span className="text-slate-500">Ready</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* FINAL ROUND SUMMARY CARD */}
          {phase === 'FINISHED' && finishedRecord && (
            <div
              className={`rounded-2xl border p-4 shadow-xl sm:p-5 ${
                finishedRecord.isWin
                  ? 'border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-[#0d162a] to-emerald-950/30'
                  : 'border-slate-700/80 bg-[#0b1325]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      finishedRecord.isWin
                        ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
                        : 'border-slate-700 bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3
                      className={`text-base font-black sm:text-lg ${
                        finishedRecord.isWin ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {finishedRecord.isWin
                        ? `Bingo Win! +${finishedRecord.totalReward.toLocaleString()} Coins`
                        : 'Round Complete — No Target Milestones Hit'}
                    </h3>
                    <p className="text-xs text-slate-400 tabular-nums">
                      Finished in {finishedRecord.totalCallsMade} calls · Ticket Bet{' '}
                      {finishedRecord.bet.toLocaleString()} · Net{' '}
                      <span
                        className={`font-bold ${
                          finishedRecord.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {finishedRecord.net >= 0 ? '+' : ''}
                        {finishedRecord.net.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 sm:text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  Play Again
                </button>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT / SECONDARY COLUMN: SETUP / BETTING PANEL + 1-90 CALLED BOARD */}
        <section className="min-w-0 space-y-4 lg:col-span-5">
          {/* Ticket Wager & Launch Card */}
          <div className="rounded-2xl border border-amber-500/25 bg-[#0b1325] p-3.5 shadow-xl sm:p-4">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="bingo-bet-input"
                className="text-xs font-bold uppercase tracking-wider text-amber-300"
              >
                Ticket Wager
              </label>
              <span className="text-[11px] text-slate-400 tabular-nums">
                Min {BINGO_MIN_BET} · Max {BINGO_MAX_BET.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 min-w-0">
                <Coins className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                <input
                  id="bingo-bet-input"
                  type="number"
                  min={BINGO_MIN_BET}
                  max={BINGO_MAX_BET}
                  step={10}
                  disabled={phase !== 'SETUP'}
                  value={activeBetForEval}
                  onChange={e => handleBetChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-2.5 text-sm font-bold text-white tabular-nums focus:border-amber-400 focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                disabled={phase !== 'SETUP'}
                onClick={() => handleBetChange(Math.max(BINGO_MIN_BET, Math.floor(bet / 2)))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-50"
              >
                ½
              </button>
              <button
                type="button"
                disabled={phase !== 'SETUP'}
                onClick={() => handleBetChange(Math.min(BINGO_MAX_BET, profile.coins, bet * 2))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-50"
              >
                2×
              </button>
              <button
                type="button"
                disabled={phase !== 'SETUP'}
                onClick={() => handleBetChange(Math.min(BINGO_MAX_BET, profile.coins))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-amber-300 hover:border-amber-400/50 disabled:opacity-50"
              >
                MAX
              </button>
            </div>

            {/* Quick Bet Presets */}
            <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {BET_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  disabled={phase !== 'SETUP' || preset > profile.coins}
                  onClick={() => {
                    soundManager.playButtonClick();
                    handleBetChange(preset);
                  }}
                  className={`rounded-md border py-1 text-[11px] font-bold tabular-nums transition ${
                    activeBetForEval === preset
                      ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                      : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {preset >= 1000 ? '1K' : preset}
                </button>
              ))}
            </div>

            {/* Payout Summary */}
            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs tabular-nums">
              <span className="text-slate-400">Max Combined Payout (28.9x)</span>
              <span className="font-black text-emerald-400">
                {maxPotentialReward.toLocaleString()} coins
              </span>
            </div>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="mt-3">
              {phase === 'SETUP' ? (
                <button
                  type="button"
                  disabled={bet < BINGO_MIN_BET || bet > profile.coins}
                  onClick={handleStartBingo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  Start Bingo ({bet.toLocaleString()} Coins)
                </button>
              ) : phase === 'FINISHED' ? (
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" />
                  New Ticket & Play Again
                </button>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-amber-200">
                  Draw In Progress — Call {calledCount} of {BINGO_TOTAL_BALLS}
                </div>
              )}
            </div>
          </div>

          {/* FULL 1–90 CALLED-NUMBER BOARD */}
          <div className="rounded-2xl border border-slate-800 bg-[#0b1325] p-3 shadow-xl sm:p-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-amber-300">
                1–90 Called Board
              </h2>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  Latest
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Match
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Called
                </span>
              </div>
            </div>

            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: BINGO_TOTAL_BALLS }, (_, i) => i + 1).map(num => {
                const isCalled = calledSet.has(num);
                const isOnTicket = ticketNumberSet.has(num);
                const isLatest = latestBall === num;

                return (
                  <div
                    key={num}
                    className={`flex h-6 items-center justify-center rounded text-[10px] font-bold tabular-nums transition sm:h-7 sm:text-xs ${
                      isLatest
                        ? 'bg-amber-400 font-black text-slate-950 ring-2 ring-white shadow'
                        : isCalled && isOnTicket
                        ? 'bg-emerald-500/90 font-black text-slate-950'
                        : isCalled
                        ? 'bg-sky-600/80 text-white'
                        : isOnTicket
                        ? 'border border-amber-500/35 bg-slate-900/90 text-amber-200/85'
                        : 'bg-slate-900/50 text-slate-500'
                    }`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Career Summary Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Rounds / Full House
              </div>
              <div className="mt-0.5 text-sm font-black tabular-nums text-white">
                {stats.roundsPlayed} / <span className="text-amber-300">{stats.fullHouseWins}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Career Net Profit
              </div>
              <div
                className={`mt-0.5 text-sm font-black tabular-nums ${
                  stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.netProfit >= 0 ? '+' : ''}
                {stats.netProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* History & Statistics Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-[#090f1f] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-black text-amber-300">Royal Bingo History</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-800 p-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Rounds</div>
                <div className="text-sm font-black text-white tabular-nums">
                  {stats.roundsPlayed}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">1L / 2L / FH</div>
                <div className="text-sm font-black text-amber-300 tabular-nums">
                  {stats.oneLineWins}/{stats.twoLinesWins}/{stats.fullHouseWins}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Best Win</div>
                <div className="text-sm font-black text-emerald-400 tabular-nums">
                  {stats.bestReward.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Net Profit</div>
                <div
                  className={`text-sm font-black tabular-nums ${
                    stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {stats.netProfit >= 0 ? '+' : ''}
                  {stats.netProfit.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {history.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">
                  <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-400/60" />
                  No Bingo rounds played yet. Start a 90-ball draw!
                </div>
              ) : (
                history.map(item => (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      item.isWin
                        ? 'border-emerald-500/35 bg-emerald-950/20'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-100 tabular-nums">
                        Bet {item.bet.toLocaleString()} · {item.totalCallsMade} Balls Called
                      </span>
                      <span
                        className={`font-black tabular-nums ${
                          item.isWin ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.isWin
                          ? `+${item.totalReward.toLocaleString()} (Net ${item.net >= 0 ? '+' : ''}${item.net.toLocaleString()})`
                          : `-${item.bet.toLocaleString()}`}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          item.oneLine.earned
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        1L: {item.oneLine.earned ? `Hit #${item.oneLine.achievedAtCall}` : 'Miss'}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          item.twoLines.earned
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        2L: {item.twoLines.earned ? `Hit #${item.twoLines.achievedAtCall}` : 'Miss'}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-semibold ${
                          item.fullHouse.earned
                            ? 'bg-amber-500/25 text-amber-200'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        FH: {item.fullHouse.earned ? `Hit #${item.fullHouse.achievedAtCall}` : 'Miss'}
                      </span>
                      <span className="ml-auto text-slate-500">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Game Rules Drawer */}
      <InGameRuleDrawer
        gameId="bingo"
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
};
