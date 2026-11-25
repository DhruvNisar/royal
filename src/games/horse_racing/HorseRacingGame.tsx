import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  HorseBetType,
  HorseRacePhase,
  HorseRaceResult,
} from '../../types';
import {
  HORSE_MIN_BET,
  HORSE_MAX_BET,
  HORSE_DEFAULT_BET,
  HORSE_TARGET_RTP,
  HORSE_BET_META,
  calculateBetEventProbability,
  calculateGrossMultiplier,
  calculateHorsePayout,
  formatHorseMultiplier,
  getRequiredSelectionCount,
  isWinningOrderForBet,
  validateHorseSelections,
} from './horseMath';
import {
  createRaceField,
  generateWeightedFinishOrder,
  createRaceAnimationPlan,
  sampleHorseProgress,
  validateHorseBetAmount,
  loadHorseHistory,
  appendHorseHistoryRecord,
  calculateHorseStats,
  RaceFieldSetup,
  RaceAnimationPlan,
} from './horseLogic';
import { HorseSprite } from './HorseSprite';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Coins,
  History,
  Trophy,
  Flag,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Timer,
  Sparkles,
  Award,
  RefreshCw,
} from 'lucide-react';

interface HorseRacingGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

const BET_TYPES: HorseBetType[] = ['WIN', 'PLACE', 'SHOW', 'EXACTA', 'QUINELLA', 'TRIFECTA'];
const BET_PRESETS = [10, 25, 50, 100, 250, 500, 1000] as const;

export const HorseRacingGame: React.FC<HorseRacingGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  // --- Race Field & Phase ---
  const [raceField, setRaceField] = useState<RaceFieldSetup>(() => createRaceField(1));
  const [phase, setPhase] = useState<HorseRacePhase>('BETTING');
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  // --- Betting Slip State ---
  const [betType, setBetType] = useState<HorseBetType>('WIN');
  const [selections, setSelections] = useState<number[]>([1]);
  const [betAmount, setBetAmount] = useState<number>(HORSE_DEFAULT_BET);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Active Race Animation State ---
  const [horseProgress, setHorseProgress] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  });
  const [raceClockSec, setRaceClockSec] = useState<number>(0);
  const [gateOpen, setGateOpen] = useState<boolean>(false);
  const [lockedResult, setLockedResult] = useState<HorseRaceResult | null>(null);

  // --- Drawers, History & Celebration ---
  const [history, setHistory] = useState<HorseRaceResult[]>(() => loadHorseHistory());
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // --- Concurrency & Single-Settlement Guards ---
  const settledRaceIdsRef = useRef<Set<string>>(new Set());
  const rafIdRef = useRef<number | null>(null);
  const countdownTimersRef = useRef<number[]>([]);
  const celebrationTimerRef = useRef<number | null>(null);
  const activePlanRef = useRef<RaceAnimationPlan | null>(null);
  const raceElapsedMsRef = useRef<number>(0);
  const lastFrameTsRef = useRef<number | null>(null);
  const lastGallopSfxMsRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const stats = useMemo(() => calculateHorseStats(history), [history]);

  // Clear all timers and animation frames on unmount
  const clearAllAnimations = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    countdownTimersRef.current.forEach(t => window.clearTimeout(t));
    countdownTimersRef.current = [];
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllAnimations();
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, [clearAllAnimations]);

  // Pause frame timer cleanly when tab is hidden so animation never leaps past finish
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastFrameTsRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // --- Live Bet Odds & Potential Payout Calculation ---
  const selectionValidation = useMemo(
    () => validateHorseSelections(betType, selections),
    [betType, selections]
  );

  const betQuote = useMemo(() => {
    if (!selectionValidation.valid) {
      return {
        probability: 0,
        multiplier: 0,
        potentialPayout: 0,
        potentialNet: 0,
      };
    }
    const probability = calculateBetEventProbability(
      raceField.distribution,
      betType,
      selections
    );
    const multiplier = calculateGrossMultiplier(probability, HORSE_TARGET_RTP);
    const potentialPayout = calculateHorsePayout(betAmount, multiplier);
    const potentialNet = potentialPayout - betAmount;
    return { probability, multiplier, potentialPayout, potentialNet };
  }, [raceField.distribution, betType, selections, betAmount, selectionValidation.valid]);

  // Live top-3 leaderboard during race or final finish order once done
  const liveStandings = useMemo(() => {
    if (phase === 'FINISHED' && lockedResult) {
      return lockedResult.finishOrder;
    }
    if (phase === 'RACING') {
      const plan = activePlanRef.current;
      return [...raceField.runners]
        .sort((a, b) => {
          const pa = horseProgress[a.number] ?? 0;
          const pb = horseProgress[b.number] ?? 0;
          if (Math.abs(pb - pa) > 0.0005) return pb - pa;
          if (plan) {
            return (
              (plan.trajectories[a.number]?.finishRank ?? 9) -
              (plan.trajectories[b.number]?.finishRank ?? 9)
            );
          }
          return a.number - b.number;
        })
        .map(r => r.number);
    }
    return [];
  }, [phase, lockedResult, raceField.runners, horseProgress]);

  const runnerByNumber = useMemo(() => {
    const map: Record<number, RaceFieldSetup['runners'][number]> = {};
    raceField.runners.forEach(r => {
      map[r.number] = r;
    });
    return map;
  }, [raceField.runners]);

  // --- Handlers ---
  const handleSelectBetType = (nextType: HorseBetType) => {
    if (phase !== 'BETTING') return;
    soundManager.playButtonClick();
    setBetType(nextType);
    setErrorMessage(null);
    const req = getRequiredSelectionCount(nextType);
    setSelections(prev => {
      // Keep valid prefix up to required count
      if (prev.length > req) return prev.slice(0, req);
      return prev;
    });
  };

  const handleToggleHorse = (horseNum: number) => {
    if (phase !== 'BETTING') return;
    soundManager.playButtonClick();
    setErrorMessage(null);
    const required = getRequiredSelectionCount(betType);

    setSelections(prev => {
      const existingIdx = prev.indexOf(horseNum);
      if (existingIdx !== -1) {
        return prev.filter(n => n !== horseNum);
      }
      if (required === 1) {
        return [horseNum];
      }
      if (prev.length >= required) {
        // Replace the last slot cleanly
        return [...prev.slice(0, required - 1), horseNum];
      }
      return [...prev, horseNum];
    });
  };

  const handleClearSelections = () => {
    if (phase !== 'BETTING') return;
    soundManager.playButtonClick();
    setSelections([]);
    setErrorMessage(null);
  };

  const handleBetAmountChange = (val: number) => {
    if (phase !== 'BETTING') return;
    const clamped = Math.max(0, Math.min(HORSE_MAX_BET, Math.floor(val)));
    setBetAmount(clamped);
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

  const finalizeRace = useCallback(
    (
      raceId: string,
      snapshotField: RaceFieldSetup,
      finishOrder: number[],
      snapshotBetType: HorseBetType,
      snapshotSelections: number[],
      snapshotBetAmount: number,
      snapshotMultiplier: number
    ) => {
      if (settledRaceIdsRef.current.has(raceId)) {
        return;
      }
      settledRaceIdsRef.current.add(raceId);

      const isWin = isWinningOrderForBet(snapshotBetType, snapshotSelections, finishOrder);
      const payout = isWin ? calculateHorsePayout(snapshotBetAmount, snapshotMultiplier) : 0;
      const net = payout - snapshotBetAmount;

      if (isWin && payout > 0) {
        storageManager.executeTransaction(
          'win',
          'horse_racing',
          payout,
          `Royal Horse Racing #${snapshotField.raceNumber} ${snapshotBetType} Win (${formatHorseMultiplier(snapshotMultiplier)})`
        );
        storageManager.updateAchievementProgress('horse_first_win', 1);
        if (
          snapshotBetType === 'EXACTA' ||
          snapshotBetType === 'QUINELLA' ||
          snapshotBetType === 'TRIFECTA'
        ) {
          storageManager.updateAchievementProgress('horse_exotic_hit', 1);
        }
        soundManager.playWin();
        if (isMountedRef.current) {
          setShowCelebration(true);
          if (celebrationTimerRef.current !== null) {
            window.clearTimeout(celebrationTimerRef.current);
          }
          celebrationTimerRef.current = window.setTimeout(() => {
            if (isMountedRef.current) setShowCelebration(false);
          }, 3200);
        }
      } else {
        soundManager.playLoss();
      }

      storageManager.recordGameRound('horse_racing', isWin, payout);
      onUpdateProfile();

      const record: HorseRaceResult = {
        id: raceId,
        raceNumber: snapshotField.raceNumber,
        raceTitle: snapshotField.raceTitle,
        timestamp: Date.now(),
        horses: snapshotField.runners.map(r => ({
          number: r.number,
          name: r.name,
          silkPrimary: r.silkPrimary,
        })),
        finishOrder,
        betType: snapshotBetType,
        selections: [...snapshotSelections],
        betAmount: snapshotBetAmount,
        multiplier: snapshotMultiplier,
        payout,
        net,
        isWin,
      };

      const updatedHistory = appendHorseHistoryRecord(record);
      if (isMountedRef.current) {
        setHistory(updatedHistory);
        setLockedResult(record);
        setPhase('FINISHED');
      }
    },
    [onUpdateProfile]
  );

  const handleStartRace = () => {
    if (phase !== 'BETTING') return;

    const selCheck = validateHorseSelections(betType, selections);
    if (!selCheck.valid) {
      setErrorMessage(selCheck.error || 'Please complete your horse selection.');
      soundManager.playButtonClick();
      return;
    }

    const betCheck = validateHorseBetAmount(betAmount, profile.coins);
    if (!betCheck.valid) {
      setErrorMessage(betCheck.error || 'Invalid wager amount.');
      soundManager.playButtonClick();
      return;
    }

    const probability = calculateBetEventProbability(
      raceField.distribution,
      betType,
      selections
    );
    const multiplier = calculateGrossMultiplier(probability, HORSE_TARGET_RTP);

    // Atomic single deduction BEFORE race begins
    const tx = storageManager.executeTransaction(
      'bet',
      'horse_racing',
      betAmount,
      `Royal Horse Racing #${raceField.raceNumber} — ${betType} (${selections.map(n => `#${n}`).join('-')})`
    );
    if (!tx.success) {
      setErrorMessage(tx.error || 'Unable to place wager.');
      return;
    }
    onUpdateProfile();

    // Generate cryptographically fair outcome & lock it BEFORE animation starts
    const raceId = `race_${raceField.raceNumber}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const finishOrder = generateWeightedFinishOrder(raceField.runners);
    const plan = createRaceAnimationPlan(finishOrder);
    activePlanRef.current = plan;

    // Snapshots for settlement closure
    const snapshotField = raceField;
    const snapshotBetType = betType;
    const snapshotSelections = [...selections];
    const snapshotBetAmount = betAmount;
    const snapshotMultiplier = multiplier;

    // Reset race track visuals
    clearAllAnimations();
    setErrorMessage(null);
    setLockedResult(null);
    setShowCelebration(false);
    setGateOpen(false);
    setRaceClockSec(0);
    setHorseProgress({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    raceElapsedMsRef.current = 0;
    lastFrameTsRef.current = null;
    lastGallopSfxMsRef.current = 0;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const beginRunningLoop = () => {
      if (!isMountedRef.current) return;
      setGateOpen(true);
      setPhase('RACING');
      setCountdownLabel('GO!');
      soundManager.playRaceStartBell();

      const clearGoTimer = window.setTimeout(() => {
        if (isMountedRef.current) setCountdownLabel(null);
      }, 650);
      countdownTimersRef.current.push(clearGoTimer);

      const speedScale = prefersReducedMotion ? 5.5 : 1.0;
      const totalDurationMs = plan.lastFinishMs + 650;

      const step = (now: number) => {
        if (!isMountedRef.current) return;

        if (document.visibilityState === 'hidden') {
          lastFrameTsRef.current = null;
          rafIdRef.current = window.requestAnimationFrame(step);
          return;
        }

        if (lastFrameTsRef.current === null) {
          lastFrameTsRef.current = now;
        }
        const deltaMs = Math.min(64, Math.max(0, now - lastFrameTsRef.current));
        lastFrameTsRef.current = now;

        raceElapsedMsRef.current += deltaMs * speedScale;
        const elapsed = raceElapsedMsRef.current;

        const nextProgress: Record<number, number> = {};
        for (let num = 1; num <= 6; num++) {
          nextProgress[num] = sampleHorseProgress(plan.trajectories[num], elapsed);
        }

        setHorseProgress(nextProgress);
        setRaceClockSec(Math.min(elapsed, plan.winnerFinishMs) / 1000);

        if (!prefersReducedMotion && elapsed - lastGallopSfxMsRef.current >= 360 && elapsed < plan.lastFinishMs) {
          lastGallopSfxMsRef.current = elapsed;
          soundManager.playHorseGallopStep();
        }

        if (elapsed >= totalDurationMs) {
          rafIdRef.current = null;
          finalizeRace(
            raceId,
            snapshotField,
            finishOrder,
            snapshotBetType,
            snapshotSelections,
            snapshotBetAmount,
            snapshotMultiplier
          );
          return;
        }

        rafIdRef.current = window.requestAnimationFrame(step);
      };

      rafIdRef.current = window.requestAnimationFrame(step);
    };

    if (prefersReducedMotion) {
      beginRunningLoop();
      return;
    }

    // 3 -> 2 -> 1 -> GO! countdown
    setPhase('COUNTDOWN');
    setCountdownLabel('3');
    soundManager.playRaceCountdownTick(false);

    const t1 = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setCountdownLabel('2');
      soundManager.playRaceCountdownTick(false);
    }, 650);

    const t2 = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setCountdownLabel('1');
      soundManager.playRaceCountdownTick(false);
    }, 1300);

    const t3 = window.setTimeout(() => {
      beginRunningLoop();
    }, 1950);

    countdownTimersRef.current = [t1, t2, t3];
  };

  const handleNextRace = () => {
    if (phase === 'COUNTDOWN' || phase === 'RACING') return;
    soundManager.playButtonClick();
    clearAllAnimations();
    const nextField = createRaceField(raceField.raceNumber + 1);
    setRaceField(nextField);
    setPhase('BETTING');
    setCountdownLabel(null);
    setGateOpen(false);
    setRaceClockSec(0);
    setLockedResult(null);
    setShowCelebration(false);
    setErrorMessage(null);
    setHorseProgress({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    // Keep current bet type & adjust selection default cleanly
    const req = getRequiredSelectionCount(betType);
    setSelections(req === 1 ? [1] : []);
  };

  const isLocked = phase === 'COUNTDOWN' || phase === 'RACING';
  const betMeta = HORSE_BET_META[betType];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#060913] text-slate-100 pb-10">
      <CoinCelebration active={showCelebration} />

      {/* Top Navigation & Status Bar */}
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
                <Flag className="h-4 w-4 shrink-0 text-amber-400" />
                <h1 className="truncate text-sm font-black tracking-wide text-amber-300 sm:text-lg">
                  ROYAL HORSE RACING
                </h1>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                Race #{raceField.raceNumber} · {raceField.raceTitle}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {/* Wallet Pill */}
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-300 tabular-nums sm:px-3 sm:text-sm">
              <Coins className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{profile.coins.toLocaleString()}</span>
            </div>

            {profile.coins < 50 && !isLocked && (
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
              aria-label="Race History and Stats"
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
              aria-label="Game Rules"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">Rules</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="mx-auto mt-3 grid max-w-7xl grid-cols-1 gap-4 px-3 sm:mt-5 sm:gap-5 sm:px-5 lg:grid-cols-12">
        {/* LEFT / TOP COLUMN: LIVE TURF TRACK + STANDINGS + RESULTS */}
        <section className="min-w-0 space-y-4 lg:col-span-7">
          {/* Race Status & Live Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-[#0a1324] px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  phase === 'RACING'
                    ? 'animate-pulse bg-emerald-400'
                    : phase === 'COUNTDOWN'
                    ? 'animate-pulse bg-amber-400'
                    : phase === 'FINISHED'
                    ? 'bg-sky-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-bold uppercase tracking-wider text-slate-200">
                {phase === 'BETTING'
                  ? 'Post Time — Place Your Bet'
                  : phase === 'COUNTDOWN'
                  ? 'Runners At The Gate'
                  : phase === 'RACING'
                  ? 'Live Derby In Progress'
                  : 'Official Photo Finish'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold tabular-nums text-amber-300">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/90 px-2 py-1 text-slate-200 border border-slate-700/60">
                <Timer className="h-3.5 w-3.5 text-amber-400" />
                {raceClockSec.toFixed(2)}s
              </span>
              <span className="hidden text-slate-400 sm:inline">95% RTP</span>
            </div>
          </div>

          {/* LIVE ANIMATED RACE TRACK */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/35 bg-gradient-to-b from-[#0a291a] via-[#0d3522] to-[#082215] shadow-2xl">
            {/* Top Stadium Rail */}
            <div className="flex items-center justify-between border-b-2 border-amber-400/50 bg-[#071a11] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-200/80 sm:text-xs">
              <span>Start Gate</span>
              <div className="flex items-center gap-4 sm:gap-10 text-emerald-300/60">
                <span>1/4</span>
                <span>1/2</span>
                <span>3/4</span>
              </div>
              <span className="text-amber-300">Finish</span>
            </div>

            {/* 6 Turf Lanes */}
            <div className="relative">
              {/* Vertical Furlong Lines */}
              <div className="pointer-events-none absolute inset-y-0 left-[29%] w-px border-l border-dashed border-emerald-200/15" />
              <div className="pointer-events-none absolute inset-y-0 left-[52%] w-px border-l border-dashed border-emerald-200/15" />
              <div className="pointer-events-none absolute inset-y-0 left-[73%] w-px border-l border-dashed border-emerald-200/15" />

              {/* Starting Gate Barrier */}
              <div
                className={`pointer-events-none absolute inset-y-0 left-[11%] sm:left-[9%] z-10 w-1 transition-all duration-300 ${
                  gateOpen
                    ? 'bg-emerald-300/20 opacity-40'
                    : 'bg-amber-300/80 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                }`}
              />

              {/* Checkered Gold/White Finish Line */}
              <div
                className="pointer-events-none absolute inset-y-0 right-[12%] sm:right-[10%] z-10 w-2.5 sm:w-3 opacity-90"
                style={{
                  backgroundImage:
                    'repeating-conic-gradient(#f8fafc 0% 25%, #0f172a 0% 50%)',
                  backgroundSize: '8px 8px',
                }}
              />
              <div className="pointer-events-none absolute inset-y-0 right-[12%] sm:right-[10%] z-10 w-0.5 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />

              {raceField.runners.map((runner, idx) => {
                const progress = horseProgress[runner.number] ?? 0;
                const isPicked = selections.includes(runner.number);
                const rankIdx =
                  phase === 'FINISHED' && lockedResult
                    ? lockedResult.finishOrder.indexOf(runner.number)
                    : -1;
                const isWinner = rankIdx === 0;

                // Map progress [0, 1.038] -> left % inside runway so horse nose crosses finish line cleanly at 320px..2560px
                const clampedLeftPct = Math.min(78, Math.max(0, progress * 75));

                return (
                  <div
                    key={runner.number}
                    className={`relative flex h-12 sm:h-14 items-center border-b border-emerald-300/15 last:border-b-0 ${
                      idx % 2 === 0 ? 'bg-emerald-950/35' : 'bg-emerald-900/25'
                    } ${isPicked ? 'ring-1 ring-inset ring-amber-400/50 bg-amber-500/10' : ''}`}
                  >
                    {/* Lane Number Gate Box */}
                    <div
                      className="z-20 flex h-full w-8 sm:w-10 shrink-0 flex-col items-center justify-center border-r border-amber-400/25 text-xs font-black text-white shadow-inner"
                      style={{ backgroundColor: `${runner.silkPrimary}cc` }}
                    >
                      <span>{runner.number}</span>
                    </div>

                    {/* Subtle Lane Name Watermark */}
                    <div className="pointer-events-none absolute left-11 sm:left-14 z-0 truncate text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-100/20">
                      {runner.name}
                    </div>

                    {/* Runway */}
                    <div className="relative flex-1 min-w-0 h-full overflow-hidden">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 will-change-transform"
                        style={{ left: `${clampedLeftPct}%` }}
                      >
                        <HorseSprite
                          runner={runner}
                          isRunning={phase === 'RACING' && progress < 1.015}
                          isWinner={isWinner}
                          isSelected={isPicked}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Finish Rank Badge */}
                    {phase === 'FINISHED' && rankIdx !== -1 && (
                      <div
                        className={`z-20 mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black shadow ${
                          rankIdx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : rankIdx === 1
                            ? 'bg-slate-200 text-slate-900'
                            : rankIdx === 2
                            ? 'bg-amber-700 text-amber-100'
                            : 'bg-slate-900/90 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {rankIdx + 1}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Countdown Overlay (3, 2, 1, GO!) */}
              {countdownLabel && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px]">
                  <div className="rounded-2xl border-2 border-amber-400 bg-slate-950/90 px-7 py-3 text-4xl sm:text-6xl font-black tracking-wider text-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.5)]">
                    {countdownLabel}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Rail */}
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-600/50 via-amber-300/80 to-amber-600/50" />
          </div>

          {/* Live Leader Strip During Race */}
          {phase === 'RACING' && liveStandings.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-[#0b1325] p-2.5 sm:p-3">
              {[0, 1, 2].map(pos => {
                const hNum = liveStandings[pos];
                const runner = runnerByNumber[hNum];
                if (!runner) return null;
                return (
                  <div
                    key={pos}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1.5"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        pos === 0
                          ? 'bg-amber-400 text-slate-950'
                          : pos === 1
                          ? 'bg-slate-300 text-slate-950'
                          : 'bg-amber-700 text-white'
                      }`}
                    >
                      {pos + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-slate-100">
                        #{runner.number} {runner.name}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* OFFICIAL RESULT & PODIUM CARD */}
          {phase === 'FINISHED' && lockedResult && (
            <div
              className={`rounded-2xl border p-4 shadow-xl sm:p-5 ${
                lockedResult.isWin
                  ? 'border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-[#0d162a] to-emerald-950/30'
                  : 'border-slate-700/80 bg-[#0b1325]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {lockedResult.isWin ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      <Trophy className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 border border-slate-700">
                      <Flag className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h2
                      className={`text-base font-black sm:text-lg ${
                        lockedResult.isWin ? 'text-amber-300' : 'text-slate-200'
                      }`}
                    >
                      {lockedResult.isWin
                        ? `Winning Ticket! +${lockedResult.payout.toLocaleString()} Coins`
                        : 'Photo Finish — Better Luck Next Race'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {lockedResult.betType} on{' '}
                      {lockedResult.selections.map(n => `#${n}`).join(' → ')} · Wager{' '}
                      {lockedResult.betAmount.toLocaleString()} · Net{' '}
                      <span
                        className={`font-bold tabular-nums ${
                          lockedResult.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {lockedResult.net >= 0 ? '+' : ''}
                        {lockedResult.net.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNextRace}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 sm:text-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                  Next Race
                </button>
              </div>

              {/* Podium 1st / 2nd / 3rd */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[0, 1, 2].map(idx => {
                  const hNum = lockedResult.finishOrder[idx];
                  const runner = runnerByNumber[hNum];
                  if (!runner) return null;
                  const medalLabel = idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : '3rd Place';
                  return (
                    <div
                      key={hNum}
                      className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                        idx === 0
                          ? 'border-amber-400/50 bg-amber-500/10'
                          : idx === 1
                          ? 'border-slate-500/40 bg-slate-800/60'
                          : 'border-amber-800/50 bg-amber-950/25'
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white shadow"
                        style={{ backgroundColor: runner.silkPrimary }}
                      >
                        #{runner.number}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90">
                          {medalLabel}
                        </div>
                        <div className="truncate text-xs font-bold text-white">
                          {runner.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Complete 1-6 Order */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Official Order:</span>
                {lockedResult.finishOrder.map((hNum, idx) => (
                  <span
                    key={hNum}
                    className="rounded-md border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 font-mono text-slate-200"
                  >
                    {idx + 1}. #{hNum}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compact Career Strip (Desktop & Mobile) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Races Played
              </div>
              <div className="mt-0.5 text-base font-black tabular-nums text-white">
                {stats.racesPlayed}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Win Rate
              </div>
              <div className="mt-0.5 text-base font-black tabular-nums text-amber-300">
                {stats.winRate.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Best Payout
              </div>
              <div className="mt-0.5 text-base font-black tabular-nums text-emerald-400">
                {stats.bestPayout.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0b1325] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Net Profit
              </div>
              <div
                className={`mt-0.5 text-base font-black tabular-nums ${
                  stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {stats.netProfit >= 0 ? '+' : ''}
                {stats.netProfit.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT / BOTTOM COLUMN: BETTING SLIP & HORSE LINEUP */}
        <section className="min-w-0 space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-amber-500/25 bg-[#0b1325] p-3.5 shadow-xl sm:p-4">
            {/* Bet Type Selector */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  1. Select Bet Type
                </span>
                <span className="text-[11px] text-slate-400">
                  {betMeta.requiredCount} {betMeta.requiredCount === 1 ? 'Horse' : 'Horses'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {BET_TYPES.map(type => {
                  const active = betType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleSelectBetType(type)}
                      className={`rounded-lg border px-2 py-2 text-xs font-bold transition ${
                        active
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200 shadow-inner'
                          : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {HORSE_BET_META[type].label}
                    </button>
                  );
                })}
              </div>

              <p className="mt-2 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-[11px] text-slate-300">
                <span className="font-bold text-amber-300">{betMeta.label}:</span> {betMeta.shortRule}
              </p>
            </div>

            {/* 6-Horse Lineup Selection */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  2. {betMeta.selectionPrompt}
                </span>
                {selections.length > 0 && phase === 'BETTING' && (
                  <button
                    type="button"
                    onClick={handleClearSelections}
                    className="text-[11px] font-semibold text-slate-400 hover:text-amber-300"
                  >
                    Clear Picks
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {raceField.runners.map(runner => {
                  const selIdx = selections.indexOf(runner.number);
                  const isSelected = selIdx !== -1;
                  const badgeLabel = betMeta.ordered
                    ? selIdx === 0
                      ? '1st'
                      : selIdx === 1
                      ? '2nd'
                      : '3rd'
                    : 'Pick';

                  const displayOdds =
                    betType === 'PLACE'
                      ? runner.placeMultiplier
                      : betType === 'SHOW'
                      ? runner.showMultiplier
                      : runner.winMultiplier;
                  const oddsCaption =
                    betType === 'PLACE'
                      ? 'Place'
                      : betType === 'SHOW'
                      ? 'Show'
                      : 'Win';

                  return (
                    <button
                      key={runner.number}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleToggleHorse(runner.number)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.18)]'
                          : 'border-slate-800 bg-slate-900/75 hover:border-slate-600'
                      } disabled:cursor-not-allowed disabled:opacity-65`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {/* Silk Swatch & Horse Number */}
                        <span
                          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white shadow"
                          style={{
                            background: `linear-gradient(135deg, ${runner.silkPrimary} 60%, ${runner.silkSecondary} 100%)`,
                          }}
                        >
                          {runner.number}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-slate-100 sm:text-sm">
                              {runner.name}
                            </span>
                            {isSelected && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                {badgeLabel}
                              </span>
                            )}
                          </div>

                          {/* Rating bar */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                              RTG {runner.rating}
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400"
                                style={{ width: `${runner.rating}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right tabular-nums">
                        <div className="text-xs font-black text-amber-300 sm:text-sm">
                          {formatHorseMultiplier(displayOdds)}
                        </div>
                        <div className="text-[10px] text-slate-400">{oddsCaption}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wager Amount Controls */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="horse-bet-input"
                  className="text-xs font-bold uppercase tracking-wider text-amber-300"
                >
                  3. Wager Amount
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  Min {HORSE_MIN_BET} · Max {HORSE_MAX_BET.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Coins className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                  <input
                    id="horse-bet-input"
                    type="number"
                    min={HORSE_MIN_BET}
                    max={HORSE_MAX_BET}
                    step={10}
                    disabled={isLocked}
                    value={betAmount}
                    onChange={e => handleBetAmountChange(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-2.5 text-sm font-bold text-white tabular-nums focus:border-amber-400 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleBetAmountChange(Math.max(HORSE_MIN_BET, Math.floor(betAmount / 2)))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-50"
                >
                  ½
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    handleBetAmountChange(Math.min(HORSE_MAX_BET, profile.coins, betAmount * 2))
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-slate-200 hover:border-amber-400/50 disabled:opacity-50"
                >
                  2×
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => handleBetAmountChange(Math.min(HORSE_MAX_BET, profile.coins))}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-bold text-amber-300 hover:border-amber-400/50 disabled:opacity-50"
                >
                  MAX
                </button>
              </div>

              {/* Quick Bet Chips */}
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {BET_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isLocked || preset > profile.coins}
                    onClick={() => {
                      soundManager.playButtonClick();
                      handleBetAmountChange(preset);
                    }}
                    className={`rounded-md border py-1 text-[11px] font-bold tabular-nums transition ${
                      betAmount === preset
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-600'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {preset >= 1000 ? '1K' : preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Ticket Quote Summary */}
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-slate-950/90 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Selected Ticket</span>
                <span className="font-bold text-slate-100">
                  {selections.length > 0
                    ? `${betMeta.label}: ${selections.map(n => `#${n}`).join(betMeta.ordered ? ' → ' : ' & ')}`
                    : 'Incomplete'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-800/90 pt-2 text-center tabular-nums">
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Win Chance</div>
                  <div className="text-xs font-bold text-slate-200 sm:text-sm">
                    {betQuote.probability > 0 ? `${(betQuote.probability * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Multiplier</div>
                  <div className="text-xs font-black text-amber-300 sm:text-sm">
                    {betQuote.multiplier > 0 ? formatHorseMultiplier(betQuote.multiplier) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Gross Payout</div>
                  <div className="text-xs font-black text-emerald-400 sm:text-sm">
                    {betQuote.potentialPayout > 0
                      ? betQuote.potentialPayout.toLocaleString()
                      : '—'}
                  </div>
                </div>
              </div>
              {betQuote.potentialPayout > 0 && (
                <div className="mt-1.5 text-right text-[11px] text-slate-400 tabular-nums">
                  Est. Net Profit:{' '}
                  <span className="font-bold text-emerald-300">
                    +{betQuote.potentialNet.toLocaleString()} coins
                  </span>
                </div>
              )}
            </div>

            {/* Validation Error */}
            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Primary CTA Button */}
            <div className="mt-4">
              {phase === 'FINISHED' ? (
                <button
                  type="button"
                  onClick={handleNextRace}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110"
                >
                  <RotateCcw className="h-4 w-4" />
                  Prepare Race #{raceField.raceNumber + 1}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isLocked || !selectionValidation.valid || betAmount < HORSE_MIN_BET || betAmount > profile.coins}
                  onClick={handleStartRace}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  {phase === 'COUNTDOWN'
                    ? 'Starting Gate Closing...'
                    : phase === 'RACING'
                    ? 'Race In Progress...'
                    : `Place Bet & Start Race (${betAmount.toLocaleString()})`}
                </button>
              )}
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
                <h2 className="text-base font-black text-amber-300">
                  Royal Horse Racing History
                </h2>
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
                <div className="text-[10px] uppercase text-slate-400">Races</div>
                <div className="text-sm font-black text-white tabular-nums">{stats.racesPlayed}</div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">W / L</div>
                <div className="text-sm font-black text-amber-300 tabular-nums">
                  {stats.wins} / {stats.losses}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 text-center">
                <div className="text-[10px] uppercase text-slate-400">Total Won</div>
                <div className="text-sm font-black text-emerald-400 tabular-nums">
                  {stats.totalWon.toLocaleString()}
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
                  No completed races yet. Place a wager to start the derby!
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
                      <span className="font-bold text-slate-100">
                        Race #{item.raceNumber} · {item.betType} ({item.selections.map(n => `#${n}`).join('-')})
                      </span>
                      <span
                        className={`font-black tabular-nums ${
                          item.isWin ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.isWin
                          ? `+${item.payout.toLocaleString()} (${formatHorseMultiplier(item.multiplier)})`
                          : `-${item.betAmount.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        Order: {item.finishOrder.map((n, i) => `${i + 1}:#${n}`).join(' ')}
                      </span>
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
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
        gameId="horse_racing"
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
};
