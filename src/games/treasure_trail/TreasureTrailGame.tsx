import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  UserProfile,
  TreasureTrailState,
  TreasureStagePlan,
  TreasureStageRecord,
  TreasureTrailRoundResult,
} from '../../types';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  TREASURE_STAGE_COUNT,
  TREASURE_STAGE_DEFINITIONS,
  TREASURE_MIN_BET,
  TREASURE_MAX_BET,
  TREASURE_QUICK_BETS,
  TREASURE_MAX_MULTIPLIER,
  getTreasureMultiplier,
  calculateTreasureGrossPayout,
  calculateTreasureNetProfit,
  formatTreasureMultiplier,
} from './treasureMath';
import {
  generateTreasureTrailPlan,
  validateTreasureBet,
  loadTreasureHistory,
  saveTreasureHistory,
  calculateTreasureStats,
} from './treasureLogic';
import { TreasureDoorCard } from './TreasureDoorCard';
import {
  ArrowLeft,
  BookOpen,
  History,
  Volume2,
  VolumeX,
  Compass,
  Coins,
  Trophy,
  CheckCircle2,
  Skull,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  X,
  Sparkles,
} from 'lucide-react';

interface TreasureTrailGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

export const TreasureTrailGame: React.FC<TreasureTrailGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  // Betting & UI state
  const [betInput, setBetInput] = useState<string>('100');
  const [betError, setBetError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<TreasureTrailState>('SETUP');

  // Active round state (locked before stage 1 begins)
  const [activeBet, setActiveBet] = useState<number>(100);
  const [stagePlans, setStagePlans] = useState<TreasureStagePlan[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0); // 0..9
  const [completedStages, setCompletedStages] = useState<TreasureStageRecord[]>([]);
  const [selectedPathIndex, setSelectedPathIndex] = useState<0 | 1 | 2 | null>(null);
  const [lastSettledRound, setLastSettledRound] = useState<TreasureTrailRoundResult | null>(null);

  // History, modals, sound & celebration
  const [history, setHistory] = useState<TreasureTrailRoundResult[]>(() => loadTreasureHistory());
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRuleDrawer, setShowRuleDrawer] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => soundManager.getSettings().sfxEnabled);

  // Concurrency & settlement integrity guards
  const activeRoundIdRef = useRef<string | null>(null);
  const deductedRoundIdsRef = useRef<Set<string>>(new Set());
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const isActionLockedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const mountedRef = useRef<boolean>(true);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(id => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter(t => t !== id);
      if (mountedRef.current) {
        fn();
      }
    }, ms);
    timersRef.current.push(id);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const parsedBet = useMemo(() => {
    const n = Number(betInput);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }, [betInput]);

  const stats = useMemo(() => calculateTreasureStats(history), [history]);

  const stagesClearedCount = useMemo(
    () => completedStages.filter(s => s.outcome === 'safe').length,
    [completedStages]
  );

  const currentStageMeta =
    stagePlans[currentStageIndex] ?? TREASURE_STAGE_DEFINITIONS[currentStageIndex] ?? TREASURE_STAGE_DEFINITIONS[0];

  const currentMultiplier = stagesClearedCount > 0 ? getTreasureMultiplier(stagesClearedCount) : 1;
  const nextStageMultiplier = getTreasureMultiplier(Math.min(TREASURE_STAGE_COUNT, stagesClearedCount + 1));
  const currentPotentialGross =
    stagesClearedCount > 0 ? calculateTreasureGrossPayout(activeBet, stagesClearedCount) : 0;
  const currentPotentialNet =
    stagesClearedCount > 0 ? calculateTreasureNetProfit(activeBet, currentPotentialGross) : 0;
  const previewMaxReward = calculateTreasureGrossPayout(
    parsedBet > 0 ? parsedBet : TREASURE_MIN_BET,
    TREASURE_STAGE_COUNT
  );

  const handleToggleMute = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    const current = storageManager.getSoundSettings();
    const updated = { ...current, sfxEnabled: next };
    soundManager.updateSettings(updated);
    storageManager.saveSoundSettings(updated);
    if (next) {
      soundManager.playButtonClick();
    }
  };

  // Finalize & settle round EXACTLY ONCE
  const settleRoundOnce = useCallback(
    (
      roundId: string,
      betAmount: number,
      clearedCount: number,
      outcome: 'COLLECTED' | 'MAX_WIN' | 'TRAP_LOSS'
    ) => {
      if (settledRoundIdsRef.current.has(roundId)) {
        return;
      }
      settledRoundIdsRef.current.add(roundId);

      const finalMultiplier = clearedCount > 0 && outcome !== 'TRAP_LOSS' ? getTreasureMultiplier(clearedCount) : 0;
      const grossPayout =
        outcome === 'TRAP_LOSS' ? 0 : calculateTreasureGrossPayout(betAmount, clearedCount);
      const netProfit = calculateTreasureNetProfit(betAmount, grossPayout);

      if (grossPayout > 0) {
        const desc =
          outcome === 'MAX_WIN'
            ? `Royal Treasure Trail — All 10 Stages Cleared (${formatTreasureMultiplier(finalMultiplier)})`
            : `Royal Treasure Trail — Collected Stage ${clearedCount} (${formatTreasureMultiplier(finalMultiplier)})`;
        storageManager.executeTransaction('win', 'treasure_trail', grossPayout, desc);
      }

      const isWin = outcome !== 'TRAP_LOSS' && grossPayout > 0;
      storageManager.recordGameRound('treasure_trail', isWin, grossPayout);

      if (isWin) {
        storageManager.updateAchievementProgress('treasure_first_collect', 1);
        if (clearedCount >= 5) {
          storageManager.updateAchievementProgress('treasure_stage_5', 1);
        }
        if (outcome === 'MAX_WIN' || clearedCount >= TREASURE_STAGE_COUNT) {
          storageManager.updateAchievementProgress('treasure_master_10', 1);
        }
      }

      const record: TreasureTrailRoundResult = {
        id: roundId,
        timestamp: Date.now(),
        bet: betAmount,
        stagesCompleted: clearedCount,
        finalMultiplier,
        grossPayout,
        netProfit,
        outcome,
      };

      setLastSettledRound(record);
      setHistory(prev => {
        const next = [record, ...prev].slice(0, 50);
        saveTreasureHistory(next);
        return next;
      });

      onUpdateProfile();

      if (outcome === 'MAX_WIN') {
        soundManager.playBigWin();
        setShowCelebration(true);
        scheduleTimer(() => setShowCelebration(false), 3200);
      } else if (outcome === 'COLLECTED') {
        soundManager.playTreasureCollect();
        setShowCelebration(true);
        scheduleTimer(() => setShowCelebration(false), 2200);
      }

      setGameState(outcome === 'TRAP_LOSS' ? 'SETTLED_LOSS' : 'SETTLED_WIN');
      isActionLockedRef.current = false;
    },
    [onUpdateProfile, scheduleTimer]
  );

  const handleStartAdventure = () => {
    if (isActionLockedRef.current) return;
    if (gameState !== 'SETUP' && gameState !== 'SETTLED_WIN' && gameState !== 'SETTLED_LOSS') {
      return;
    }

    const latestBalance = storageManager.getProfile().coins;
    const validation = validateTreasureBet(parsedBet, latestBalance);
    if (!validation.valid) {
      setBetError(validation.error ?? 'Invalid wager.');
      soundManager.playLoss();
      return;
    }

    const idBuf = new Uint32Array(1);
    crypto.getRandomValues(idBuf);
    const roundId = `tt_${Date.now()}_${idBuf[0].toString(36)}`;
    if (deductedRoundIdsRef.current.has(roundId)) return;

    // Generate & lock all 10 stages cryptographically BEFORE deducting/starting
    const generatedPlan = generateTreasureTrailPlan();

    const deductRes = storageManager.executeTransaction(
      'bet',
      'treasure_trail',
      parsedBet,
      `Royal Treasure Trail — Adventure Entry (${parsedBet.toLocaleString()} coins)`
    );

    if (!deductRes.success) {
      setBetError(deductRes.error ?? 'Could not deduct wager.');
      soundManager.playLoss();
      return;
    }

    deductedRoundIdsRef.current.add(roundId);
    activeRoundIdRef.current = roundId;
    isActionLockedRef.current = false;
    clearAllTimers();

    soundManager.playChipStack();
    setBetError(null);
    setActiveBet(parsedBet);
    setStagePlans(generatedPlan);
    setCurrentStageIndex(0);
    setCompletedStages([]);
    setSelectedPathIndex(null);
    setLastSettledRound(null);
    setShowCelebration(false);
    setGameState('CHOOSING_PATH');
    onUpdateProfile();
  };

  const handleSelectPath = (pathIndex: 0 | 1 | 2) => {
    if (gameState !== 'CHOOSING_PATH' || isActionLockedRef.current) return;
    const plan = stagePlans[currentStageIndex];
    const roundId = activeRoundIdRef.current;
    if (!plan || !roundId) return;

    isActionLockedRef.current = true;
    setSelectedPathIndex(pathIndex);
    setGameState('REVEALING_PATH');
    soundManager.playTreasureDoorOpen();

    const chosenOutcome = plan.paths[pathIndex];

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealDelayMs = reducedMotion ? 160 : 420;

    scheduleTimer(() => {
      const stageRecord: TreasureStageRecord = {
        stageNumber: plan.stageNumber,
        chosenPathIndex: pathIndex,
        outcome: chosenOutcome,
        trapPathIndex: plan.trapPathIndex,
      };

      const updatedCompleted = [...completedStages, stageRecord];
      setCompletedStages(updatedCompleted);

      if (chosenOutcome === 'trap') {
        soundManager.playTreasureTrap();
        const clearedBeforeTrap = updatedCompleted.filter(s => s.outcome === 'safe').length;
        settleRoundOnce(roundId, activeBet, clearedBeforeTrap, 'TRAP_LOSS');
      } else {
        soundManager.playTreasureSafe(plan.stageNumber);
        const clearedNow = updatedCompleted.filter(s => s.outcome === 'safe').length;

        if (clearedNow >= TREASURE_STAGE_COUNT) {
          // Stage 10 completed — automatically settle maximum reward!
          setGameState('COLLECTING');
          scheduleTimer(() => {
            settleRoundOnce(roundId, activeBet, TREASURE_STAGE_COUNT, 'MAX_WIN');
          }, reducedMotion ? 180 : 650);
        } else {
          setGameState('STAGE_DECISION');
          isActionLockedRef.current = false;
        }
      }
    }, revealDelayMs);
  };

  const handleContinueNextStage = () => {
    if (gameState !== 'STAGE_DECISION' || isActionLockedRef.current) return;
    if (currentStageIndex + 1 >= TREASURE_STAGE_COUNT) return;
    soundManager.playButtonClick();
    setSelectedPathIndex(null);
    setCurrentStageIndex(prev => prev + 1);
    setGameState('CHOOSING_PATH');
  };

  const handleCollectWinnings = () => {
    if (gameState !== 'STAGE_DECISION' || isActionLockedRef.current) return;
    const roundId = activeRoundIdRef.current;
    if (!roundId || stagesClearedCount <= 0) return;

    isActionLockedRef.current = true;
    setGameState('COLLECTING');
    soundManager.playChipStack();

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scheduleTimer(() => {
      settleRoundOnce(roundId, activeBet, stagesClearedCount, 'COLLECTED');
    }, reducedMotion ? 120 : 380);
  };

  const handleResetToSetup = () => {
    if (gameState === 'REVEALING_PATH' || gameState === 'COLLECTING') return;
    soundManager.playButtonClick();
    clearAllTimers();
    activeRoundIdRef.current = null;
    isActionLockedRef.current = false;
    setStagePlans([]);
    setCurrentStageIndex(0);
    setCompletedStages([]);
    setSelectedPathIndex(null);
    setLastSettledRound(null);
    setGameState('SETUP');
  };

  const handleQuickBet = (amount: number) => {
    soundManager.playChipClick();
    setBetError(null);
    setBetInput(String(Math.min(TREASURE_MAX_BET, amount)));
  };

  const handleAdjustBet = (mode: 'half' | 'double' | 'max') => {
    soundManager.playButtonClick();
    setBetError(null);
    const current = Math.max(TREASURE_MIN_BET, parsedBet || TREASURE_MIN_BET);
    if (mode === 'half') {
      setBetInput(String(Math.max(TREASURE_MIN_BET, Math.floor(current / 2))));
    } else if (mode === 'double') {
      setBetInput(String(Math.min(TREASURE_MAX_BET, Math.min(profile.coins, current * 2))));
    } else {
      setBetInput(String(Math.max(TREASURE_MIN_BET, Math.min(TREASURE_MAX_BET, profile.coins))));
    }
  };

  const isInActiveRound =
    gameState === 'CHOOSING_PATH' ||
    gameState === 'REVEALING_PATH' ||
    gameState === 'STAGE_DECISION' ||
    gameState === 'COLLECTING';

  const currentStageRevealed =
    gameState === 'STAGE_DECISION' ||
    gameState === 'COLLECTING' ||
    gameState === 'SETTLED_WIN' ||
    gameState === 'SETTLED_LOSS';

  const activeStagePlan = stagePlans[currentStageIndex] ?? null;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#08090d] text-slate-100 pb-10">
      <CoinCelebration active={showCelebration} />

      {/* Top Navigation & Telemetry Strip */}
      <div className="w-full border-b border-amber-500/20 bg-[#0e1017]/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                clearAllTimers();
                onBackToLobby();
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#161923] hover:bg-[#1e2230] border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors min-h-[38px]"
              aria-label="Back to previous page"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Exit</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-serif font-black text-[13px] sm:text-lg gold-text-gradient tracking-wider uppercase truncate">
                ROYAL TREASURE TRAIL
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden sm:block">
                10 Ancient Stages · 2 Safe Paths, 1 Trap · 95% RTP
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <div className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#141722] border border-amber-500/30 flex items-center gap-1.5 min-h-[38px]">
              <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono font-bold text-xs sm:text-sm text-amber-300 tabular-nums">
                {profile.coins.toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={sfxEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
              className="p-2 rounded-xl bg-[#161923] hover:bg-[#1e2230] border border-slate-800 text-slate-300 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
            >
              {sfxEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setShowHistoryModal(true);
              }}
              aria-label="View adventure history and stats"
              className="p-2 sm:px-3 rounded-xl bg-[#161923] hover:bg-[#1e2230] border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">History</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setShowRuleDrawer(true);
              }}
              aria-label="Open game rules"
              className="p-2 sm:px-3 rounded-xl bg-[#161923] hover:bg-[#1e2230] border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 sm:gap-5 items-start">
          {/* LEFT COLUMN: 10-Stage Trail Map + Ancient Temple Stage Arena */}
          <div className="min-w-0 space-y-3 sm:space-y-4">
            {/* 10-Stage Progression Trail Map (5x2 on mobile, 10x1 on sm+, zero horizontal scroll) */}
            <div className="rounded-2xl bg-[#11131b] border border-amber-500/20 p-2.5 sm:p-4">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-serif font-bold text-amber-200 uppercase tracking-wider truncate">
                    10-Stage Temple Trail
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                  Cleared: <strong className="text-amber-300">{stagesClearedCount}</strong> / {TREASURE_STAGE_COUNT}
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {TREASURE_STAGE_DEFINITIONS.map((stage, idx) => {
                  const rec = completedStages.find(r => r.stageNumber === stage.stageNumber);
                  const isCleared = rec?.outcome === 'safe';
                  const isTrapped = rec?.outcome === 'trap';
                  const isCurrent =
                    isInActiveRound && currentStageIndex === idx && !isCleared && !isTrapped;
                  const mult = getTreasureMultiplier(stage.stageNumber);

                  return (
                    <div
                      key={stage.stageNumber}
                      className={`rounded-xl border px-1 py-1.5 text-center transition-all min-w-0 flex flex-col items-center justify-center ${
                        isCleared
                          ? 'bg-emerald-950/55 border-emerald-500/50 text-emerald-200'
                          : isTrapped
                            ? 'bg-rose-950/65 border-rose-500/60 text-rose-300'
                            : isCurrent
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                              : 'bg-[#171a24] border-slate-800/90 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-0.5 text-[10px] font-bold">
                        {isCleared ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : isTrapped ? (
                          <Skull className="w-3 h-3 text-rose-400 shrink-0" />
                        ) : null}
                        <span className="tabular-nums">S{stage.stageNumber}</span>
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-mono font-semibold tabular-nums mt-0.5 truncate max-w-full">
                        {formatTreasureMultiplier(mult, true)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Temple Sanctuary Chamber */}
            <div
              className={`rounded-2xl border border-amber-500/25 bg-gradient-to-b ${
                TREASURE_STAGE_DEFINITIONS[currentStageIndex]?.chamberTone ??
                'from-amber-950/30 via-[#131722] to-[#0e1118]'
              } p-3 sm:p-5 shadow-2xl space-y-4`}
            >
              {/* Chamber Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-amber-500/15">
                <div className="min-w-0">
                  <div className="text-[11px] text-amber-400/90 font-semibold uppercase tracking-wider">
                    {gameState === 'SETUP'
                      ? 'Ready to Enter the Sanctuary'
                      : `Stage ${currentStageIndex + 1} of ${TREASURE_STAGE_COUNT}`}
                  </div>
                  <h2 className="font-serif font-bold text-base sm:text-xl text-slate-100 truncate">
                    {currentStageMeta.title}
                  </h2>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-right">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Current Mult</div>
                    <div className="font-mono font-bold text-sm sm:text-base text-amber-300 tabular-nums">
                      {stagesClearedCount > 0 ? formatTreasureMultiplier(currentMultiplier) : '1.00×'}
                    </div>
                  </div>
                  <div className="pl-3 border-l border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Next Stage</div>
                    <div className="font-mono font-bold text-sm sm:text-base text-emerald-300 tabular-nums">
                      {formatTreasureMultiplier(nextStageMultiplier)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instruction Banner */}
              <div className="text-xs sm:text-sm text-slate-300 flex items-center justify-between gap-2 bg-black/30 rounded-xl px-3 py-2 border border-slate-800/80">
                <span className="min-w-0">
                  {gameState === 'SETUP' &&
                    'Set your wager and press Start Adventure to unlock the first ancient doorway.'}
                  {gameState === 'CHOOSING_PATH' &&
                    'Choose 1 of the 3 ancient doors. Two hold royal treasure — one conceals a trap.'}
                  {gameState === 'REVEALING_PATH' && 'Unsealing the temple stone doorway…'}
                  {gameState === 'STAGE_DECISION' &&
                    `Safe passage! Collect ${currentPotentialGross.toLocaleString()} coins now, or venture into Stage ${currentStageIndex + 2} for ${formatTreasureMultiplier(nextStageMultiplier)}.`}
                  {gameState === 'COLLECTING' && 'Securing your royal treasure chest…'}
                  {gameState === 'SETTLED_WIN' &&
                    lastSettledRound &&
                    `Expedition succeeded! Collected ${lastSettledRound.grossPayout.toLocaleString()} coins (${formatTreasureMultiplier(lastSettledRound.finalMultiplier)}).`}
                  {gameState === 'SETTLED_LOSS' &&
                    `Ancient trap triggered in ${currentStageMeta.title}! Your expedition ended here.`}
                </span>
              </div>

              {/* THREE SELECTABLE TREASURE DOORS — Always 3 columns cleanly inside 320px+ */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {([0, 1, 2] as const).map(idx => {
                  const revealedOutcome =
                    currentStageRevealed && activeStagePlan ? activeStagePlan.paths[idx] : null;
                  return (
                    <TreasureDoorCard
                      key={`${currentStageIndex}-${idx}`}
                      pathIndex={idx}
                      stageNumber={currentStageIndex + 1}
                      relicName={currentStageMeta.relicName}
                      trapName={currentStageMeta.trapName}
                      revealedOutcome={revealedOutcome}
                      isSelected={selectedPathIndex === idx}
                      isDisabled={gameState !== 'CHOOSING_PATH'}
                      isIdlePreview={gameState === 'SETUP'}
                      onSelect={handleSelectPath}
                    />
                  );
                })}
              </div>

              {/* STAGE DECISION PANEL: CONTINUE vs COLLECT WINNINGS */}
              {gameState === 'STAGE_DECISION' && (
                <div className="rounded-2xl bg-[#10131d] border border-amber-400/40 p-3 sm:p-4 space-y-3 animate-treasure-reveal">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-black/35 p-2 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase">Original Bet</div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-slate-200 tabular-nums">
                        {activeBet.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/35 p-2 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase">Multiplier</div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-amber-300 tabular-nums">
                        {formatTreasureMultiplier(currentMultiplier)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/35 p-2 border border-emerald-500/30">
                      <div className="text-[10px] text-slate-400 uppercase">Gross Payout</div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-emerald-300 tabular-nums">
                        {currentPotentialGross.toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-xl bg-black/35 p-2 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400 uppercase">Net Profit</div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-emerald-400 tabular-nums">
                        +{currentPotentialNet.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleCollectWinnings}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95 min-h-[46px]"
                    >
                      <Trophy className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        Collect Winnings ({currentPotentialGross.toLocaleString()})
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleContinueNextStage}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-transform active:scale-95 min-h-[46px]"
                    >
                      <span className="truncate">
                        Continue · Stage {currentStageIndex + 2} ({formatTreasureMultiplier(nextStageMultiplier, true)})
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              )}

              {/* SETTLED OUTCOME BANNER */}
              {(gameState === 'SETTLED_WIN' || gameState === 'SETTLED_LOSS') && lastSettledRound && (
                <div
                  className={`rounded-2xl border p-3.5 sm:p-4 space-y-3 animate-treasure-reveal ${
                    gameState === 'SETTLED_WIN'
                      ? 'bg-emerald-950/35 border-emerald-500/45'
                      : 'bg-rose-950/35 border-rose-500/45'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {gameState === 'SETTLED_WIN' ? (
                        <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-serif font-bold text-sm sm:text-base text-white">
                          {lastSettledRound.outcome === 'MAX_WIN'
                            ? 'Grand Sanctuary Conquered! (All 10 Stages)'
                            : lastSettledRound.outcome === 'COLLECTED'
                              ? `Treasure Collected at Stage ${lastSettledRound.stagesCompleted}`
                              : `Trap Hit at Stage ${currentStageIndex + 1}`}
                        </div>
                        <div className="text-xs text-slate-300">
                          Cleared {lastSettledRound.stagesCompleted} / {TREASURE_STAGE_COUNT} stages · Multiplier{' '}
                          <span className="font-mono font-bold text-amber-300">
                            {lastSettledRound.finalMultiplier > 0
                              ? formatTreasureMultiplier(lastSettledRound.finalMultiplier)
                              : '0×'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-400">Gross Payout</div>
                      <div
                        className={`font-mono font-black text-base sm:text-lg tabular-nums ${
                          lastSettledRound.grossPayout > 0 ? 'text-emerald-300' : 'text-rose-400'
                        }`}
                      >
                        {lastSettledRound.grossPayout.toLocaleString()} coins
                      </div>
                      <div
                        className={`font-mono text-xs tabular-nums ${
                          lastSettledRound.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        Net: {lastSettledRound.netProfit >= 0 ? '+' : ''}
                        {lastSettledRound.netProfit.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleStartAdventure}
                      className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 min-h-[42px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Play Again ({parsedBet.toLocaleString()})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToSetup}
                      className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors min-h-[42px]"
                    >
                      Change Wager
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Wager Controls + Payout Ladder + Recent Expeditions */}
          <div className="min-w-0 space-y-3 sm:space-y-4">
            {/* Wager & Start Adventure Panel */}
            <div className="rounded-2xl bg-[#11131b] border border-amber-500/25 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif font-bold text-sm text-amber-200 uppercase tracking-wider">
                  Expedition Wager
                </h3>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {TREASURE_MIN_BET}–{TREASURE_MAX_BET.toLocaleString()}
                </span>
              </div>

              {/* Bet Input + Half/Double/Max */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <Coins className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={TREASURE_MIN_BET}
                      max={TREASURE_MAX_BET}
                      step={10}
                      disabled={isInActiveRound}
                      value={betInput}
                      onChange={e => {
                        setBetError(null);
                        setBetInput(e.target.value);
                      }}
                      aria-label="Wager amount in virtual coins"
                      className="w-full bg-[#171a25] border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono font-bold text-slate-100 outline-none disabled:opacity-50 tabular-nums"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isInActiveRound}
                    onClick={() => handleAdjustBet('half')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 min-h-[42px]"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    disabled={isInActiveRound}
                    onClick={() => handleAdjustBet('double')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 min-h-[42px]"
                  >
                    2×
                  </button>
                  <button
                    type="button"
                    disabled={isInActiveRound}
                    onClick={() => handleAdjustBet('max')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-amber-300 disabled:opacity-40 min-h-[42px]"
                  >
                    Max
                  </button>
                </div>

                {/* Quick Bet Buttons */}
                <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-1.5">
                  {TREASURE_QUICK_BETS.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      disabled={isInActiveRound}
                      onClick={() => handleQuickBet(chip)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors disabled:opacity-40 tabular-nums ${
                        parsedBet === chip
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-[#161923] hover:bg-[#1e2230] border-slate-800 text-slate-300'
                      }`}
                    >
                      {chip >= 1000 ? '1K' : chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Possible Reward Preview */}
              <div className="rounded-xl bg-[#0c0e14] border border-amber-500/20 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Max Possible Reward (Stage 10)
                  </div>
                  <div className="text-[11px] text-amber-300/90 font-mono">
                    {formatTreasureMultiplier(TREASURE_MAX_MULTIPLIER)} gross multiplier
                  </div>
                </div>
                <div className="font-mono font-black text-base text-amber-300 tabular-nums shrink-0">
                  {previewMaxReward.toLocaleString()}
                </div>
              </div>

              {betError && (
                <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/35 rounded-xl px-3 py-2">
                  {betError}
                </div>
              )}

              {/* Primary CTA Button */}
              {!isInActiveRound ? (
                <button
                  type="button"
                  onClick={handleStartAdventure}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2 min-h-[48px]"
                >
                  <Compass className="w-4 h-4 shrink-0" />
                  <span>Start Adventure</span>
                </button>
              ) : (
                <div className="rounded-xl bg-amber-950/25 border border-amber-500/30 px-3 py-2.5 text-xs text-amber-200 flex items-center justify-between">
                  <span>Active Stake Locked</span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums">
                    {activeBet.toLocaleString()} coins
                  </span>
                </div>
              )}

              {/* Pre-game quick link to full RulesModal */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>95% RTP · Local cryptographic RNG</span>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    onOpenRules();
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline-offset-2 hover:underline"
                >
                  Full Rulebook
                </button>
              </div>
            </div>

            {/* Compact Multiplier Ladder */}
            <div className="rounded-2xl bg-[#11131b] border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold text-slate-200 uppercase tracking-wider">
                  Multiplier Ladder
                </h3>
                <span className="text-[11px] text-slate-400">2/3 Safe per Stage</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {TREASURE_STAGE_DEFINITIONS.map(stage => {
                  const mult = getTreasureMultiplier(stage.stageNumber);
                  const payout = calculateTreasureGrossPayout(
                    isInActiveRound ? activeBet : Math.max(TREASURE_MIN_BET, parsedBet),
                    stage.stageNumber
                  );
                  const isActiveRow = isInActiveRound && currentStageIndex + 1 === stage.stageNumber;
                  return (
                    <div
                      key={stage.stageNumber}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-lg border text-[11px] min-w-0 ${
                        isActiveRow
                          ? 'bg-amber-500/15 border-amber-400/60 text-amber-200'
                          : 'bg-[#161923] border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span className="font-mono text-slate-400">S{stage.stageNumber}</span>
                      <span className="font-mono font-bold text-amber-300 tabular-nums">
                        {formatTreasureMultiplier(mult, true)}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300/90 tabular-nums truncate">
                        {payout.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Compact Recent Expeditions */}
            <div className="rounded-2xl bg-[#11131b] border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold text-slate-200 uppercase tracking-wider">
                  Recent Expeditions
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setShowHistoryModal(true);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Stats ({stats.roundsPlayed})
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">
                  No expeditions completed yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {history.slice(0, 4).map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#161923] border border-slate-800/70 text-xs"
                    >
                      <div className="min-w-0">
                        <span
                          className={`font-semibold ${
                            item.outcome === 'TRAP_LOSS' ? 'text-rose-400' : 'text-emerald-300'
                          }`}
                        >
                          {item.outcome === 'MAX_WIN'
                            ? 'Stage 10 Max'
                            : item.outcome === 'COLLECTED'
                              ? `Stage ${item.stagesCompleted} Win`
                              : `Trap (S${item.stagesCompleted + 1})`}
                        </span>
                        <span className="text-slate-500 text-[10px] ml-1.5 font-mono">
                          {item.bet.toLocaleString()} bet
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.netProfit >= 0 ? '+' : ''}
                        {item.netProfit.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History & Statistics Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#11131b] border border-amber-500/35 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-[#161923]">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h2 className="font-serif font-bold text-base text-slate-100">
                  Royal Treasure Trail — History &amp; Stats
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setShowHistoryModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Rounds</div>
                  <div className="font-mono font-bold text-base text-slate-100 tabular-nums">
                    {stats.roundsPlayed}
                  </div>
                </div>
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Win Rate</div>
                  <div className="font-mono font-bold text-base text-amber-300 tabular-nums">
                    {stats.winRate.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Best Stage</div>
                  <div className="font-mono font-bold text-base text-emerald-300 tabular-nums">
                    {stats.bestStage} / {TREASURE_STAGE_COUNT}
                  </div>
                </div>
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Net Profit</div>
                  <div
                    className={`font-mono font-bold text-base tabular-nums ${
                      stats.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {stats.totalNetProfit >= 0 ? '+' : ''}
                    {stats.totalNetProfit.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Round Records */}
              {history.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Complete an adventure to record your expedition ledger.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#161923] border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-100">
                          {item.outcome === 'MAX_WIN'
                            ? 'All 10 Stages Cleared'
                            : item.outcome === 'COLLECTED'
                              ? `Collected after Stage ${item.stagesCompleted}`
                              : `Trap Hit (Cleared ${item.stagesCompleted})`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString()} · Bet {item.bet.toLocaleString()} · Mult{' '}
                          {item.finalMultiplier > 0 ? formatTreasureMultiplier(item.finalMultiplier) : '0×'}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-slate-200 font-bold">
                          Payout: {item.grossPayout.toLocaleString()}
                        </div>
                        <div className={item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          Net: {item.netProfit >= 0 ? '+' : ''}
                          {item.netProfit.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Game Rules Drawer */}
      <InGameRuleDrawer
        gameId="treasure_trail"
        isOpen={showRuleDrawer}
        onClose={() => setShowRuleDrawer(false)}
      />
    </div>
  );
};
