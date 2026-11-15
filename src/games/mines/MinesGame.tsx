import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  MinesGameState,
  MinesRoundResult,
} from '../../types';
import {
  MINES_TOTAL_TILES,
  MINES_MIN_COUNT,
  MINES_MAX_COUNT,
  MINES_DEFAULT_COUNT,
  MINES_MIN_BET,
  MINES_MAX_BET,
  MINES_DEFAULT_BET,
  MINES_TARGET_RTP,
  calculateMinesMultiplier,
  calculateMinesPayout,
  calculateNextPickSafeProbability,
  formatMinesMultiplier,
  getMinesRiskTier,
  getMinesMultiplierSchedule,
} from './minesMath';
import {
  MinesRoundSession,
  createReadyMinesSession,
  startMinesRound,
  revealMinesTile,
  cashOutMinesRound,
  validateMinesBet,
  validateMinesCount,
  generateAutoPickSequence,
  loadMinesHistory,
  appendMinesHistoryRecord,
  saveMinesHistory,
} from './minesLogic';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Gem,
  Bomb,
  Coins,
  ShieldCheck,
  AlertCircle,
  Play,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  History,
  SlidersHorizontal,
} from 'lucide-react';

interface MinesGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface AutoPlayStats {
  totalPlanned: number;
  completed: number;
  wagered: number;
  returned: number;
  stopReason: string | null;
}

const MINE_COUNT_PRESETS = [1, 3, 5, 10, 18, 24] as const;

export const MinesGame: React.FC<MinesGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  // Configuration state
  const [betInput, setBetInput] = useState<string>(String(MINES_DEFAULT_BET));
  const [mineCount, setMineCount] = useState<number>(MINES_DEFAULT_COUNT);

  // Round session state + synchronous ref to prevent double reveals/settlements
  const [session, setSession] = useState<MinesRoundSession>(() =>
    createReadyMinesSession(MINES_DEFAULT_BET, MINES_DEFAULT_COUNT)
  );
  const sessionRef = useRef<MinesRoundSession>(session);
  const actionLockRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const onUpdateProfileRef = useRef(onUpdateProfile);
  onUpdateProfileRef.current = onUpdateProfile;

  // UI & secondary panels
  const [history, setHistory] = useState<MinesRoundResult[]>(() => loadMinesHistory());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [showHistoryMobile, setShowHistoryMobile] = useState<boolean>(false);
  const [showAutoPanel, setShowAutoPanel] = useState<boolean>(false);

  // Auto Play configuration & state
  const [autoRoundsInput, setAutoRoundsInput] = useState<string>('10');
  const [autoPicksInput, setAutoPicksInput] = useState<string>('3');
  const [stopProfitInput, setStopProfitInput] = useState<string>('0');
  const [stopLossInput, setStopLossInput] = useState<string>('0');
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [autoStats, setAutoStats] = useState<AutoPlayStats | null>(null);

  const autoRunningRef = useRef<boolean>(false);
  const autoStopRequestedRef = useRef<boolean>(false);
  const autoTimerRef = useRef<number | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoRunningRef.current = false;
      autoStopRequestedRef.current = true;
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, []);

  const parsedBet = useMemo(() => {
    const num = Number(betInput);
    return Number.isFinite(num) ? Math.floor(num) : 0;
  }, [betInput]);

  const activeBet = session.state === 'READY' ? parsedBet : session.bet;
  const activeMines = session.state === 'READY' ? mineCount : session.mineCount;
  const totalSafeForConfig = MINES_TOTAL_TILES - activeMines;
  const revealedSafeCount = session.revealedTiles.length;
  const remainingSafeCount = Math.max(0, totalSafeForConfig - revealedSafeCount);

  const riskTier = useMemo(() => getMinesRiskTier(activeMines), [activeMines]);
  const firstPickSafePct = useMemo(
    () => (calculateNextPickSafeProbability(activeMines, 0) * 100).toFixed(1),
    [activeMines]
  );

  const nextSafePickProb = useMemo(
    () => calculateNextPickSafeProbability(activeMines, revealedSafeCount),
    [activeMines, revealedSafeCount]
  );

  const nextMultiplier = useMemo(() => {
    if (revealedSafeCount >= totalSafeForConfig) return null;
    return calculateMinesMultiplier(activeMines, revealedSafeCount + 1);
  }, [activeMines, revealedSafeCount, totalSafeForConfig]);

  const currentMultiplier =
    session.state === 'PLAYING'
      ? session.currentMultiplier
      : session.state === 'READY'
      ? 1
      : session.currentMultiplier;

  const potentialPayout = useMemo(() => {
    if (session.state === 'PLAYING') {
      return revealedSafeCount > 0
        ? calculateMinesPayout(session.bet, session.currentMultiplier)
        : 0;
    }
    if (session.state === 'CASHED_OUT' || session.state === 'WON') {
      return session.payout;
    }
    return 0;
  }, [session.state, session.bet, session.currentMultiplier, session.payout, revealedSafeCount]);

  const potentialNet = useMemo(() => {
    if (session.state === 'PLAYING') {
      return revealedSafeCount > 0 ? potentialPayout - session.bet : 0;
    }
    if (session.state === 'CASHED_OUT' || session.state === 'WON' || session.state === 'LOST') {
      return session.net;
    }
    return 0;
  }, [session.state, session.bet, session.net, potentialPayout, revealedSafeCount]);

  const multiplierSchedule = useMemo(
    () => getMinesMultiplierSchedule(activeMines),
    [activeMines]
  );

  const commitSession = useCallback((next: MinesRoundSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const recordCompletedRound = useCallback(
    (completed: MinesRoundSession, isAuto: boolean = false) => {
      const safeCount = completed.revealedTiles.length;
      const isWin = completed.state === 'CASHED_OUT' || completed.state === 'WON';
      const outcome: MinesRoundResult['outcome'] =
        completed.state === 'WON'
          ? 'WON'
          : completed.state === 'CASHED_OUT'
          ? 'CASHED_OUT'
          : 'LOST';

      const record: MinesRoundResult = {
        id: completed.roundId || `mines_${Date.now()}`,
        timestamp: Date.now(),
        bet: completed.bet,
        mineCount: completed.mineCount,
        safeRevealed: safeCount,
        multiplier: isWin ? completed.currentMultiplier : 0,
        payout: completed.payout,
        net: completed.net,
        outcome,
      };

      const updatedHistory = appendMinesHistoryRecord(record);
      if (mountedRef.current) {
        setHistory(updatedHistory);
      }

      // Update Mines career achievements
      storageManager.incrementAchievementProgress('mines_master', 1);
      if (isWin && safeCount >= 5) {
        storageManager.updateAchievementProgress('mines_lucky_escape', 1);
      }

      if (!isAuto && isWin && completed.currentMultiplier >= 3) {
        setCelebrateWin(true);
      }
      onUpdateProfileRef.current();
    },
    []
  );

  const handleStartRound = useCallback(() => {
    if (actionLockRef.current || autoRunningRef.current) return;
    const current = sessionRef.current;
    if (current.state === 'PLAYING') return;

    const latestProfile = storageManager.getProfile();
    const betCheck = validateMinesBet(parsedBet, latestProfile.coins);
    if (!betCheck.valid) {
      setErrorMsg(betCheck.error || 'Invalid wager.');
      return;
    }
    const mineCheck = validateMinesCount(mineCount);
    if (!mineCheck.valid) {
      setErrorMsg(mineCheck.error || 'Invalid mine count.');
      return;
    }

    actionLockRef.current = true;
    try {
      const tx = storageManager.executeTransaction(
        'bet',
        'mines',
        parsedBet,
        `Mines – Bet (${mineCount} ${mineCount === 1 ? 'Mine' : 'Mines'})`
      );
      if (!tx.success) {
        setErrorMsg(tx.error || 'Insufficient virtual coins.');
        return;
      }

      const nextRound = startMinesRound(parsedBet, mineCount);
      setErrorMsg(null);
      commitSession(nextRound);
      soundManager.playChipClick();
      onUpdateProfileRef.current();
    } finally {
      actionLockRef.current = false;
    }
  }, [parsedBet, mineCount, commitSession]);

  const handleTileSelect = useCallback(
    (tileIndex: number) => {
      if (actionLockRef.current || autoRunningRef.current) return;
      const current = sessionRef.current;
      if (current.state !== 'PLAYING' || current.settled) return;

      actionLockRef.current = true;
      try {
        soundManager.playMinesTileClick();
        const res = revealMinesTile(current, tileIndex);
        if (!res.accepted) return;

        commitSession(res.session);

        if (res.hitMine) {
          soundManager.playMinesExplosion();
          storageManager.recordGameRound('mines', false, 0);
          recordCompletedRound(res.session, false);
          return;
        }

        // Safe diamond revealed
        const safeCount = res.session.revealedTiles.length;
        storageManager.updateAchievementProgress('mines_first_diamond', 1);
        storageManager.incrementAchievementProgress('mines_diamond_hunter', 1);

        if (res.autoWon) {
          // Automatically settle full board clear
          const tx = storageManager.executeTransaction(
            'win',
            'mines',
            res.session.payout,
            `Mines – Full Clear (${safeCount} Diamonds, ${formatMinesMultiplier(
              res.session.currentMultiplier
            )})`
          );
          if (tx.success) {
            storageManager.recordGameRound('mines', true, res.session.payout);
            soundManager.playBigWin();
            setCelebrateWin(true);
            recordCompletedRound(res.session, false);
          }
        } else {
          soundManager.playMinesDiamond(safeCount);
        }
      } finally {
        actionLockRef.current = false;
      }
    },
    [commitSession, recordCompletedRound]
  );

  const handleCashOut = useCallback(() => {
    if (actionLockRef.current || autoRunningRef.current) return;
    const current = sessionRef.current;
    if (current.state !== 'PLAYING' || current.settled || current.revealedTiles.length < 1) {
      return;
    }

    actionLockRef.current = true;
    try {
      const res = cashOutMinesRound(current);
      if (!res.accepted) return;

      const settledSession = res.session;
      const safeCount = settledSession.revealedTiles.length;
      const multLabel = formatMinesMultiplier(settledSession.currentMultiplier);

      if (settledSession.payout > 0) {
        storageManager.executeTransaction(
          'win',
          'mines',
          settledSession.payout,
          `Mines – Cash Out (${safeCount} ${
            safeCount === 1 ? 'Diamond' : 'Diamonds'
          }, ${multLabel})`
        );
      }
      storageManager.recordGameRound(
        'mines',
        settledSession.payout > settledSession.bet,
        settledSession.payout
      );

      commitSession(settledSession);
      if (settledSession.currentMultiplier >= 5) {
        soundManager.playBigWin();
      } else {
        soundManager.playMinesCashOut();
      }
      recordCompletedRound(settledSession, false);
    } finally {
      actionLockRef.current = false;
    }
  }, [commitSession, recordCompletedRound]);

  const handleResetToReady = useCallback(() => {
    if (actionLockRef.current || autoRunningRef.current) return;
    soundManager.playButtonClick();
    setErrorMsg(null);
    commitSession(createReadyMinesSession(parsedBet, mineCount));
  }, [parsedBet, mineCount, commitSession]);

  const adjustBet = (nextVal: number) => {
    if (session.state === 'PLAYING' || isAutoRunning) return;
    soundManager.playChipClick();
    const clamped = Math.max(MINES_MIN_BET, Math.min(MINES_MAX_BET, Math.floor(nextVal)));
    setBetInput(String(clamped));
    setErrorMsg(null);
  };

  const adjustMineCount = (nextCount: number) => {
    if (session.state === 'PLAYING' || isAutoRunning) return;
    const clamped = Math.max(MINES_MIN_COUNT, Math.min(MINES_MAX_COUNT, Math.floor(nextCount)));
    setMineCount(clamped);
    setErrorMsg(null);

    // Clamp auto picks if it exceeds new max safe tiles
    const maxSafe = MINES_TOTAL_TILES - clamped;
    const currentAutoPicks = Math.floor(Number(autoPicksInput)) || 1;
    if (currentAutoPicks > maxSafe) {
      setAutoPicksInput(String(maxSafe));
    }
  };

  // --- Auto Play Controller ---
  const finishAutoLoop = useCallback((reason: string | null) => {
    autoRunningRef.current = false;
    autoStopRequestedRef.current = false;
    if (autoTimerRef.current !== null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (mountedRef.current) {
      setIsAutoRunning(false);
      setAutoStats(prev => (prev ? { ...prev, stopReason: reason } : prev));
    }
  }, []);

  const handleStopAuto = () => {
    if (!autoRunningRef.current) return;
    soundManager.playButtonClick();
    autoStopRequestedRef.current = true;
    finishAutoLoop('Stopped by player');
  };

  const handleStartAuto = () => {
    if (autoRunningRef.current || sessionRef.current.state === 'PLAYING') return;

    const plannedRounds = Math.floor(Number(autoRoundsInput));
    const maxSafe = MINES_TOTAL_TILES - mineCount;
    const targetPicks = Math.floor(Number(autoPicksInput));
    const stopProfit = Math.max(0, Math.floor(Number(stopProfitInput) || 0));
    const stopLoss = Math.max(0, Math.floor(Number(stopLossInput) || 0));

    if (!Number.isFinite(plannedRounds) || plannedRounds < 1 || plannedRounds > 200) {
      setErrorMsg('Auto Play rounds must be between 1 and 200.');
      return;
    }
    if (!Number.isFinite(targetPicks) || targetPicks < 1 || targetPicks > maxSafe) {
      setErrorMsg(`Safe selections per round must be between 1 and ${maxSafe} for ${mineCount} mines.`);
      return;
    }

    const latestProfile = storageManager.getProfile();
    const betCheck = validateMinesBet(parsedBet, latestProfile.coins);
    if (!betCheck.valid) {
      setErrorMsg(betCheck.error || 'Invalid wager for Auto Play.');
      return;
    }

    soundManager.playButtonClick();
    setErrorMsg(null);
    autoRunningRef.current = true;
    autoStopRequestedRef.current = false;
    setIsAutoRunning(true);
    setAutoStats({
      totalPlanned: plannedRounds,
      completed: 0,
      wagered: 0,
      returned: 0,
      stopReason: null,
    });

    const lockedBet = parsedBet;
    const lockedMines = mineCount;
    let remainingRounds = plannedRounds;
    let cumulativeWagered = 0;
    let cumulativeReturned = 0;
    let completedCount = 0;

    const executeOneAutoRound = () => {
      if (!mountedRef.current || !autoRunningRef.current || autoStopRequestedRef.current) {
        finishAutoLoop('Stopped by player');
        return;
      }

      if (remainingRounds <= 0) {
        finishAutoLoop('Completed all scheduled rounds');
        return;
      }

      const freshProfile = storageManager.getProfile();
      if (freshProfile.coins < lockedBet) {
        finishAutoLoop('Stopped: insufficient virtual coin balance');
        return;
      }

      const betTx = storageManager.executeTransaction(
        'bet',
        'mines',
        lockedBet,
        `Mines Auto – Bet (${lockedMines} ${lockedMines === 1 ? 'Mine' : 'Mines'})`
      );
      if (!betTx.success) {
        finishAutoLoop('Stopped: bet transaction rejected');
        return;
      }

      cumulativeWagered += lockedBet;
      let activeRound = startMinesRound(lockedBet, lockedMines);
      const picks = generateAutoPickSequence(targetPicks);

      commitSession(activeRound);
      onUpdateProfileRef.current();

      let stepIdx = 0;
      const stepPick = () => {
        if (!mountedRef.current || !autoRunningRef.current) return;

        // If user hit Stop mid-round and at least 1 safe pick was revealed, cash out safely!
        if (autoStopRequestedRef.current) {
          if (activeRound.revealedTiles.length >= 1 && !activeRound.settled) {
            const cash = cashOutMinesRound(activeRound);
            if (cash.accepted) {
              activeRound = cash.session;
              if (activeRound.payout > 0) {
                storageManager.executeTransaction(
                  'win',
                  'mines',
                  activeRound.payout,
                  `Mines Auto – Cash Out (${activeRound.revealedTiles.length} Diamonds, ${formatMinesMultiplier(
                    activeRound.currentMultiplier
                  )})`
                );
              }
              storageManager.recordGameRound(
                'mines',
                activeRound.payout > activeRound.bet,
                activeRound.payout
              );
              cumulativeReturned += activeRound.payout;
              completedCount += 1;
              commitSession(activeRound);
              recordCompletedRound(activeRound, true);
              setAutoStats({
                totalPlanned: plannedRounds,
                completed: completedCount,
                wagered: cumulativeWagered,
                returned: cumulativeReturned,
                stopReason: 'Stopped by player',
              });
            }
          }
          finishAutoLoop('Stopped by player');
          return;
        }

        if (stepIdx < picks.length && activeRound.state === 'PLAYING') {
          const tile = picks[stepIdx];
          stepIdx += 1;
          const reveal = revealMinesTile(activeRound, tile);
          if (reveal.accepted) {
            activeRound = reveal.session;
            commitSession(activeRound);

            if (reveal.hitMine) {
              soundManager.playMinesExplosion();
              storageManager.recordGameRound('mines', false, 0);
              completedCount += 1;
              remainingRounds -= 1;
              recordCompletedRound(activeRound, true);

              const netSoFar = cumulativeReturned - cumulativeWagered;
              setAutoStats({
                totalPlanned: plannedRounds,
                completed: completedCount,
                wagered: cumulativeWagered,
                returned: cumulativeReturned,
                stopReason: null,
              });

              if (stopLoss > 0 && -netSoFar >= stopLoss) {
                finishAutoLoop(`Stopped: loss limit (-${stopLoss.toLocaleString()}) reached`);
                return;
              }
              if (remainingRounds <= 0) {
                finishAutoLoop('Completed all scheduled rounds');
                return;
              }
              autoTimerRef.current = window.setTimeout(executeOneAutoRound, 520);
              return;
            }

            // Safe diamond reveal
            const safeNow = activeRound.revealedTiles.length;
            storageManager.updateAchievementProgress('mines_first_diamond', 1);
            storageManager.incrementAchievementProgress('mines_diamond_hunter', 1);

            if (reveal.autoWon) {
              storageManager.executeTransaction(
                'win',
                'mines',
                activeRound.payout,
                `Mines Auto – Full Clear (${safeNow} Diamonds, ${formatMinesMultiplier(
                  activeRound.currentMultiplier
                )})`
              );
              storageManager.recordGameRound('mines', true, activeRound.payout);
              soundManager.playMinesCashOut();
              cumulativeReturned += activeRound.payout;
              completedCount += 1;
              remainingRounds -= 1;
              recordCompletedRound(activeRound, true);

              const netSoFar = cumulativeReturned - cumulativeWagered;
              setAutoStats({
                totalPlanned: plannedRounds,
                completed: completedCount,
                wagered: cumulativeWagered,
                returned: cumulativeReturned,
                stopReason: null,
              });

              if (stopProfit > 0 && netSoFar >= stopProfit) {
                finishAutoLoop(`Stopped: profit target (+${stopProfit.toLocaleString()}) reached`);
                return;
              }
              if (remainingRounds <= 0) {
                finishAutoLoop('Completed all scheduled rounds');
                return;
              }
              autoTimerRef.current = window.setTimeout(executeOneAutoRound, 520);
              return;
            }

            soundManager.playMinesDiamond(safeNow);
            autoTimerRef.current = window.setTimeout(stepPick, 220);
            return;
          }
        }

        // Configured safe selections reached — Cash Out automatically
        if (activeRound.state === 'PLAYING' && activeRound.revealedTiles.length >= 1) {
          const cash = cashOutMinesRound(activeRound);
          if (cash.accepted) {
            activeRound = cash.session;
            if (activeRound.payout > 0) {
              storageManager.executeTransaction(
                'win',
                'mines',
                activeRound.payout,
                `Mines Auto – Cash Out (${activeRound.revealedTiles.length} Diamonds, ${formatMinesMultiplier(
                  activeRound.currentMultiplier
                )})`
              );
            }
            storageManager.recordGameRound(
              'mines',
              activeRound.payout > activeRound.bet,
              activeRound.payout
            );
            soundManager.playMinesCashOut();
            cumulativeReturned += activeRound.payout;
            completedCount += 1;
            remainingRounds -= 1;
            commitSession(activeRound);
            recordCompletedRound(activeRound, true);

            const netSoFar = cumulativeReturned - cumulativeWagered;
            setAutoStats({
              totalPlanned: plannedRounds,
              completed: completedCount,
              wagered: cumulativeWagered,
              returned: cumulativeReturned,
              stopReason: null,
            });

            if (stopProfit > 0 && netSoFar >= stopProfit) {
              finishAutoLoop(`Stopped: profit target (+${stopProfit.toLocaleString()}) reached`);
              return;
            }
            if (stopLoss > 0 && -netSoFar >= stopLoss) {
              finishAutoLoop(`Stopped: loss limit (-${stopLoss.toLocaleString()}) reached`);
              return;
            }
            if (remainingRounds <= 0) {
              finishAutoLoop('Completed all scheduled rounds');
              return;
            }
            autoTimerRef.current = window.setTimeout(executeOneAutoRound, 520);
          }
        }
      };

      autoTimerRef.current = window.setTimeout(stepPick, 200);
    };

    executeOneAutoRound();
  };

  // Keyboard arrow navigation within the 5x5 grid
  const handleTileKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % MINES_TOTAL_TILES;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + MINES_TOTAL_TILES) % MINES_TOTAL_TILES;
    else if (e.key === 'ArrowDown') nextIdx = (idx + 5) % MINES_TOTAL_TILES;
    else if (e.key === 'ArrowUp') nextIdx = (idx - 5 + MINES_TOTAL_TILES) % MINES_TOTAL_TILES;

    if (nextIdx !== null) {
      e.preventDefault();
      tileRefs.current[nextIdx]?.focus();
    }
  };

  const isPlaying = session.state === 'PLAYING';
  const isFinished =
    session.state === 'CASHED_OUT' || session.state === 'LOST' || session.state === 'WON';
  const canCashOut = isPlaying && revealedSafeCount >= 1 && !isAutoRunning;
  const controlsLocked = isPlaying || isAutoRunning;

  const statusText = useMemo(() => {
    const map: Record<MinesGameState, string> = {
      READY: 'Ready to Start',
      PLAYING:
        revealedSafeCount === 0
          ? 'Pick a Vault Tile'
          : `${revealedSafeCount} Diamond${revealedSafeCount === 1 ? '' : 's'} Found`,
      CASHED_OUT: 'Cashed Out',
      LOST: 'Mine Hit',
      WON: 'Vault Cleared',
    };
    return map[session.state];
  }, [session.state, revealedSafeCount]);

  return (
    <div className="w-full max-w-full min-w-0 box-border min-h-[calc(100dvh-65px)] bg-[#08090d] text-slate-100 flex flex-col overflow-x-clip pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      <InGameRuleDrawer
        gameId="mines"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Compact Game Top Bar */}
      <div className="w-full max-w-full min-w-0 box-border bg-[#11141e]/95 border-b border-slate-800 px-2.5 sm:px-5 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onBackToLobby();
            }}
            aria-label="Back to casino lobby"
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Casino</span>
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="font-serif font-black tracking-wider text-amber-300 uppercase truncate text-sm sm:text-base leading-tight">
              Royal Mines
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate leading-tight">
              5×5 Grid · {activeMines} {activeMines === 1 ? 'Mine' : 'Mines'} · {(MINES_TARGET_RTP * 100).toFixed(0)}% RTP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Compact Wallet Balance Readout */}
          <div className="px-2 py-1 rounded-lg bg-[#090b11] border border-amber-500/25 flex items-center gap-1.5 text-xs tabular-nums">
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-mono font-bold text-amber-200">
              {profile.coins.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              setShowRulesDrawer(true);
            }}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="text-xs">Rules</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Workspace */}
      <div className="w-full max-w-[1280px] min-w-0 box-border mx-auto px-2 sm:px-5 lg:px-6 py-2 sm:py-4 space-y-3 sm:space-y-4 flex-1">
        <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_370px] xl:grid-cols-[minmax(0,1fr)_400px] gap-3 sm:gap-5 items-start">
          {/* LEFT / TOP: Primary 5x5 Board Zone */}
          <div className="w-full min-w-0 box-border bg-[#0c1018] border border-amber-500/25 rounded-2xl p-2 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3">
            {/* Live Multiplier, Safe Tiles & Potential Payout Strip */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 text-center tabular-nums">
              <div className="min-w-0 px-2 py-1.5 rounded-xl bg-[#0a0e17] border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  Multiplier
                </div>
                <div className="font-mono font-black text-sm sm:text-lg text-cyan-300 leading-tight">
                  {formatMinesMultiplier(currentMultiplier)}
                </div>
                {nextMultiplier && isPlaying && (
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    Next {formatMinesMultiplier(nextMultiplier)}
                  </div>
                )}
              </div>

              <div className="min-w-0 px-2 py-1.5 rounded-xl bg-[#0a0e17] border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  Status
                </div>
                <div
                  className={`font-semibold text-xs sm:text-sm leading-tight truncate mt-0.5 ${
                    session.state === 'LOST'
                      ? 'text-red-400'
                      : session.state === 'CASHED_OUT' || session.state === 'WON'
                      ? 'text-emerald-400'
                      : isPlaying
                      ? 'text-cyan-300'
                      : 'text-amber-300'
                  }`}
                >
                  {statusText}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {remainingSafeCount}/{totalSafeForConfig} safe left
                </div>
              </div>

              <div className="min-w-0 px-2 py-1.5 rounded-xl bg-[#0a0e17] border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider truncate">
                  {session.state === 'LOST' ? 'Result' : 'Payout'}
                </div>
                <div
                  className={`font-mono font-black text-sm sm:text-lg leading-tight ${
                    session.state === 'LOST'
                      ? 'text-red-400'
                      : potentialPayout > 0
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {session.state === 'LOST'
                    ? `-${session.bet.toLocaleString()}`
                    : potentialPayout.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {isPlaying && revealedSafeCount > 0
                    ? `Net +${potentialNet.toLocaleString()}`
                    : isPlaying
                    ? `Safe ${(nextSafePickProb * 100).toFixed(0)}%`
                    : `${activeMines}M · ${riskTier}`}
                </div>
              </div>
            </div>

            {/* 5x5 Vault Grid Container */}
            <div className="w-full min-w-0 flex justify-center">
              <div
                role="grid"
                aria-label="Royal Mines 5 by 5 board"
                className="w-full max-w-[clamp(260px,44dvh,356px)] sm:max-w-[clamp(320px,52dvh,456px)] grid grid-cols-5 gap-1.5 sm:gap-2.5"
              >
                {Array.from({ length: MINES_TOTAL_TILES }, (_, idx) => {
                  const row = Math.floor(idx / 5) + 1;
                  const col = (idx % 5) + 1;
                  const isRevealedSafe = session.revealedTiles.includes(idx);
                  const isHitMine = session.hitMineTile === idx;
                  const isMine = session.minePositions.includes(idx);
                  const showEndReveal = isFinished;
                  const isUnclickedMine = showEndReveal && isMine && !isHitMine;
                  const isUnclickedSafe = showEndReveal && !isMine && !isRevealedSafe;

                  const canClickTile =
                    isPlaying && !isRevealedSafe && !session.settled && !isAutoRunning;

                  let tileClasses =
                    'bg-gradient-to-b from-[#171d2e] to-[#0f1422] border-amber-500/25 hover:border-amber-400/70 hover:from-[#1d253b] text-slate-400 shadow-inner';
                  let tileLabel = `Row ${row} Column ${col}: Hidden tile`;

                  if (isRevealedSafe) {
                    tileClasses =
                      'bg-gradient-to-b from-cyan-950/90 to-slate-950 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.28)] text-cyan-300 animate-mines-diamond';
                    tileLabel = `Row ${row} Column ${col}: Safe diamond revealed`;
                  } else if (isHitMine) {
                    tileClasses =
                      'bg-gradient-to-b from-red-900/95 to-red-950 border-red-400 shadow-[0_0_18px_rgba(248,113,113,0.45)] text-red-200 animate-mines-bomb';
                    tileLabel = `Row ${row} Column ${col}: Mine exploded`;
                  } else if (isUnclickedMine) {
                    tileClasses =
                      'bg-[#1e1016] border-red-500/45 text-red-400/90 opacity-90';
                    tileLabel = `Row ${row} Column ${col}: Unrevealed mine`;
                  } else if (isUnclickedSafe) {
                    tileClasses =
                      'bg-[#0e1524] border-cyan-500/20 text-cyan-500/45 opacity-60';
                    tileLabel = `Row ${row} Column ${col}: Unrevealed safe diamond`;
                  } else if (!isPlaying) {
                    tileClasses =
                      'bg-gradient-to-b from-[#141928] to-[#0d111c] border-slate-800 text-slate-600';
                  }

                  return (
                    <button
                      key={idx}
                      ref={el => {
                        tileRefs.current[idx] = el;
                      }}
                      type="button"
                      role="gridcell"
                      aria-label={tileLabel}
                      disabled={!canClickTile && isPlaying}
                      onKeyDown={e => handleTileKeyDown(e, idx)}
                      onClick={() => {
                        if (canClickTile) {
                          handleTileSelect(idx);
                        }
                      }}
                      className={`aspect-square w-full min-w-0 min-h-[44px] rounded-xl sm:rounded-2xl border transition-all duration-150 flex flex-col items-center justify-center relative select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${tileClasses} ${
                        canClickTile ? 'cursor-pointer active:scale-95' : 'cursor-default'
                      }`}
                    >
                      {isRevealedSafe ? (
                        <Gem className="w-[48%] h-[48%] text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                      ) : isHitMine ? (
                        <>
                          <Bomb className="w-[46%] h-[46%] text-red-300" />
                          <span className="sr-only">Mine Hit</span>
                        </>
                      ) : isUnclickedMine ? (
                        <Bomb className="w-[40%] h-[40%] text-red-400/80" />
                      ) : isUnclickedSafe ? (
                        <Gem className="w-[36%] h-[36%] text-cyan-400/45" />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border ${
                            isPlaying
                              ? 'border-amber-400/45 bg-amber-400/15'
                              : 'border-slate-700 bg-slate-800/40'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Round Outcome Summary Banner */}
            {isFinished && (
              <div
                role="status"
                className={`p-2.5 sm:p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  session.state === 'LOST'
                    ? 'bg-red-950/50 border-red-500/40 text-red-200'
                    : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-100'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    {session.state === 'LOST' ? (
                      <>
                        <Bomb className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Mine Triggered — Stake Lost</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>
                          {session.state === 'WON' ? 'Vault Cleared!' : 'Cashed Out!'}{' '}
                          {formatMinesMultiplier(session.currentMultiplier)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] opacity-85 font-mono tabular-nums">
                    {session.state === 'LOST'
                      ? `Bet ${session.bet.toLocaleString()} · Revealed ${revealedSafeCount} safe`
                      : `Payout ${session.payout.toLocaleString()} coins (Net +${session.net.toLocaleString()})`}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAutoRunning}
                  onClick={handleResetToReady}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Play Again
                </button>
              </div>
            )}

            {/* Primary Mobile-Friendly Thumb Action CTA (Always adjacent to board) */}
            <div className="w-full min-w-0">
              {session.state === 'READY' && (
                <button
                  type="button"
                  disabled={
                    isAutoRunning ||
                    parsedBet < MINES_MIN_BET ||
                    parsedBet > MINES_MAX_BET ||
                    parsedBet > profile.coins
                  }
                  onClick={handleStartRound}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Gem className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Start Game ({parsedBet.toLocaleString()} Coins)
                  </span>
                </button>
              )}

              {isPlaying && (
                <button
                  type="button"
                  disabled={!canCashOut}
                  onClick={handleCashOut}
                  className={`w-full min-h-[48px] px-4 py-3 rounded-xl font-serif font-black text-xs sm:text-sm uppercase tracking-wider transition-transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                    canCashOut
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 shadow-xl shadow-emerald-500/25'
                      : 'bg-slate-800/90 border border-slate-700 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-4 h-4 shrink-0" />
                  <span className="truncate tabular-nums">
                    {canCashOut
                      ? `Cash Out ${potentialPayout.toLocaleString()} (+${potentialNet.toLocaleString()} · ${formatMinesMultiplier(
                          currentMultiplier
                        )})`
                      : 'Pick at Least 1 Tile to Cash Out'}
                  </span>
                </button>
              )}

              {isFinished && (
                <button
                  type="button"
                  disabled={
                    isAutoRunning ||
                    parsedBet < MINES_MIN_BET ||
                    parsedBet > MINES_MAX_BET ||
                    parsedBet > profile.coins
                  }
                  onClick={handleStartRound}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    New Round ({parsedBet.toLocaleString()} Coins)
                  </span>
                </button>
              )}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="min-w-0 break-words">{errorMsg}</span>
              </div>
            )}
          </div>

          {/* RIGHT / BOTTOM: Compact Bet, Mine Selection & Auto Play Panel */}
          <div className="w-full min-w-0 box-border bg-[#11141d] border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3.5">
            {/* Bet Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <label
                  htmlFor="mines-bet-input"
                  className="font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Bet Amount
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {MINES_MIN_BET} – {MINES_MAX_BET.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => adjustBet(parsedBet - 10)}
                  aria-label="Decrease bet by 10"
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base transition-colors shrink-0"
                >
                  -
                </button>
                <input
                  id="mines-bet-input"
                  type="number"
                  min={MINES_MIN_BET}
                  max={MINES_MAX_BET}
                  step={10}
                  disabled={controlsLocked}
                  value={betInput}
                  onChange={e => {
                    setBetInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="flex-1 min-w-0 min-h-[44px] bg-[#090b10] border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-center font-mono font-bold text-amber-300 text-base tabular-nums outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => adjustBet(parsedBet + 10)}
                  aria-label="Increase bet by 10"
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base transition-colors shrink-0"
                >
                  +
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => adjustBet(Math.max(MINES_MIN_BET, Math.floor(parsedBet / 2)))}
                  className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                >
                  1/2
                </button>
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() => adjustBet(Math.min(MINES_MAX_BET, parsedBet * 2))}
                  className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                >
                  2x
                </button>
                <button
                  type="button"
                  disabled={controlsLocked}
                  onClick={() =>
                    adjustBet(Math.min(MINES_MAX_BET, Math.max(MINES_MIN_BET, profile.coins)))
                  }
                  className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-semibold text-xs whitespace-nowrap"
                >
                  Max
                </button>
              </div>

              {parsedBet > profile.coins && !isPlaying && (
                <p className="text-[11px] text-red-400">
                  Insufficient virtual coins (Balance: {profile.coins.toLocaleString()}).
                </p>
              )}
            </div>

            {/* Mine Count Selection (1 to 24) */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                <label
                  htmlFor="mines-count-select"
                  className="font-semibold text-slate-300 uppercase tracking-wider"
                >
                  Mines ({activeMines})
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {totalSafeForConfig} Safe · {firstPickSafePct}% 1st Pick ·{' '}
                  <span
                    className={
                      riskTier === 'Low'
                        ? 'text-emerald-400 font-semibold'
                        : riskTier === 'Medium'
                        ? 'text-amber-300 font-semibold'
                        : riskTier === 'High'
                        ? 'text-orange-400 font-semibold'
                        : 'text-red-400 font-semibold'
                    }
                  >
                    {riskTier} Risk
                  </span>
                </span>
              </div>

              {/* Compact Presets + Direct Stepper/Dropdown */}
              <div className="grid grid-cols-6 gap-1">
                {MINE_COUNT_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    disabled={controlsLocked}
                    onClick={() => {
                      soundManager.playButtonClick();
                      adjustMineCount(preset);
                    }}
                    className={`min-h-[38px] py-1.5 rounded-lg border text-xs font-mono font-bold tabular-nums transition-colors disabled:opacity-50 ${
                      mineCount === preset
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-[#0b0d14] text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={controlsLocked || mineCount <= MINES_MIN_COUNT}
                  onClick={() => {
                    soundManager.playButtonClick();
                    adjustMineCount(mineCount - 1);
                  }}
                  aria-label="Decrease mines"
                  className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold"
                >
                  -
                </button>
                <input
                  type="range"
                  min={MINES_MIN_COUNT}
                  max={MINES_MAX_COUNT}
                  step={1}
                  disabled={controlsLocked}
                  value={mineCount}
                  onChange={e => adjustMineCount(Number(e.target.value))}
                  aria-label="Select mine count slider"
                  className="flex-1 min-w-0 accent-amber-400 cursor-pointer disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={controlsLocked || mineCount >= MINES_MAX_COUNT}
                  onClick={() => {
                    soundManager.playButtonClick();
                    adjustMineCount(mineCount + 1);
                  }}
                  aria-label="Increase mines"
                  className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold"
                >
                  +
                </button>
                <select
                  id="mines-count-select"
                  disabled={controlsLocked}
                  value={mineCount}
                  onChange={e => {
                    soundManager.playButtonClick();
                    adjustMineCount(Number(e.target.value));
                  }}
                  aria-label="Exact mine count"
                  className="min-h-[40px] bg-[#090b10] border border-slate-700 rounded-lg px-2 text-xs font-mono font-bold text-amber-300 outline-none disabled:opacity-50"
                >
                  {Array.from({ length: MINES_MAX_COUNT }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n}M
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Collapsible Multiplier Ladder */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                aria-expanded={showSchedule}
                onClick={() => {
                  soundManager.playButtonClick();
                  setShowSchedule(s => !s);
                }}
                className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-[#0c0f17] hover:bg-[#131724] border border-slate-800 flex items-center justify-between gap-2 text-xs transition-colors"
              >
                <span className="font-semibold text-slate-200">
                  Multiplier Ladder ({activeMines} {activeMines === 1 ? 'Mine' : 'Mines'})
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <span>{showSchedule ? 'Hide' : 'Show'}</span>
                  {showSchedule ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {showSchedule && (
                <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-0.5 tabular-nums">
                  {multiplierSchedule.map(step => (
                    <div
                      key={step.picks}
                      className={`p-1.5 rounded-lg border text-center ${
                        revealedSafeCount === step.picks
                          ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200'
                          : 'bg-[#090b11] border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400 font-mono">
                        {step.picks} {step.picks === 1 ? 'Gem' : 'Gems'}
                      </div>
                      <div className="text-xs font-mono font-bold text-amber-300">
                        {formatMinesMultiplier(step.multiplier)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">
                        {(step.survivalProbability * 100).toFixed(step.survivalProbability < 0.01 ? 2 : 1)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Collapsible Optional Auto Play Panel */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                aria-expanded={showAutoPanel}
                onClick={() => {
                  soundManager.playButtonClick();
                  setShowAutoPanel(s => !s);
                }}
                className="w-full min-h-[40px] px-2.5 py-2 rounded-xl bg-[#0c0f17] hover:bg-[#131724] border border-slate-800 flex items-center justify-between gap-2 text-xs transition-colors"
              >
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto Play Mode</span>
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                  <span>{isAutoRunning ? 'Active' : showAutoPanel ? 'Hide' : 'Configure'}</span>
                  {showAutoPanel ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {showAutoPanel && (
                <div className="mt-2.5 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="mines-auto-rounds" className="text-[11px] text-slate-400">
                        Rounds (1–200)
                      </label>
                      <input
                        id="mines-auto-rounds"
                        type="number"
                        min={1}
                        max={200}
                        disabled={isAutoRunning || isPlaying}
                        value={autoRoundsInput}
                        onChange={e => setAutoRoundsInput(e.target.value)}
                        className="w-full min-h-[38px] bg-[#090b10] border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-slate-100 tabular-nums outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="mines-auto-picks" className="text-[11px] text-slate-400">
                        Safe Picks (1–{totalSafeForConfig})
                      </label>
                      <input
                        id="mines-auto-picks"
                        type="number"
                        min={1}
                        max={totalSafeForConfig}
                        disabled={isAutoRunning || isPlaying}
                        value={autoPicksInput}
                        onChange={e => setAutoPicksInput(e.target.value)}
                        className="w-full min-h-[38px] bg-[#090b10] border border-slate-700 rounded-lg px-2 py-1 text-center font-mono font-bold text-cyan-300 tabular-nums outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label htmlFor="mines-stop-profit" className="text-[11px] text-slate-400">
                        Stop Profit (0 = off)
                      </label>
                      <input
                        id="mines-stop-profit"
                        type="number"
                        min={0}
                        step={50}
                        disabled={isAutoRunning || isPlaying}
                        value={stopProfitInput}
                        onChange={e => setStopProfitInput(e.target.value)}
                        className="w-full min-h-[38px] bg-[#090b10] border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-emerald-300 tabular-nums outline-none disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="mines-stop-loss" className="text-[11px] text-slate-400">
                        Stop Loss (0 = off)
                      </label>
                      <input
                        id="mines-stop-loss"
                        type="number"
                        min={0}
                        step={50}
                        disabled={isAutoRunning || isPlaying}
                        value={stopLossInput}
                        onChange={e => setStopLossInput(e.target.value)}
                        className="w-full min-h-[38px] bg-[#090b10] border border-slate-700 rounded-lg px-2 py-1 text-center font-mono text-red-300 tabular-nums outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {!isAutoRunning ? (
                    <button
                      type="button"
                      disabled={isPlaying || parsedBet < MINES_MIN_BET || parsedBet > profile.coins}
                      onClick={handleStartAuto}
                      className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      <span>Start Auto ({autoRoundsInput || 0} Rounds)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopAuto}
                      className="w-full min-h-[42px] py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 shrink-0" />
                      <span>Stop Auto</span>
                    </button>
                  )}

                  {autoStats && (
                    <div className="p-2.5 rounded-xl bg-[#090b11] border border-slate-800 space-y-1 text-[11px] tabular-nums">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Rounds Completed</span>
                        <span className="font-mono font-bold text-slate-200">
                          {autoStats.completed}/{autoStats.totalPlanned} (
                          {Math.max(0, autoStats.totalPlanned - autoStats.completed)} left)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Wagered / Returned</span>
                        <span className="font-mono text-slate-200">
                          {autoStats.wagered.toLocaleString()} / {autoStats.returned.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Net Result</span>
                        <span
                          className={`font-mono font-bold ${
                            autoStats.returned - autoStats.wagered >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {autoStats.returned - autoStats.wagered >= 0 ? '+' : ''}
                          {(autoStats.returned - autoStats.wagered).toLocaleString()}
                        </span>
                      </div>
                      {autoStats.stopReason && (
                        <div className="pt-1 border-t border-slate-800/80 text-amber-300">
                          {autoStats.stopReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Local browser RNG · 18+ virtual coins only</span>
            </div>
          </div>
        </div>

        {/* Game History Section (Latest 10 displayed out of 50 stored; collapsible on mobile) */}
        <div className="w-full min-w-0 box-border bg-[#11141d] border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                setShowHistoryMobile(s => !s);
              }}
              aria-expanded={showHistoryMobile}
              className="md:pointer-events-none flex items-center gap-2 text-left min-w-0"
            >
              <History className="w-4 h-4 text-amber-400 shrink-0" />
              <h2 className="font-serif font-bold text-sm sm:text-base text-slate-100 truncate">
                Recent Mines History ({Math.min(10, history.length)})
              </h2>
              <span className="md:hidden text-amber-300 text-xs flex items-center gap-0.5 shrink-0">
                {showHistoryMobile ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            </button>

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  saveMinesHistory([]);
                  setHistory([]);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className={`${showHistoryMobile ? 'block' : 'hidden md:block'}`}>
            {history.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                No Royal Mines rounds recorded yet. Start a round and reveal your first diamond!
              </div>
            ) : (
              <>
                {/* Mobile Card List */}
                <div className="md:hidden space-y-2">
                  {history.slice(0, 10).map(item => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#0b0e15] border border-slate-800/80 flex items-center justify-between gap-2 text-xs tabular-nums"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-slate-200 truncate">
                          {item.mineCount}M · {item.safeRevealed} Diamonds ·{' '}
                          {item.outcome === 'LOST' ? 'Mine Hit' : item.outcome === 'WON' ? 'Cleared' : 'Cashed Out'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Bet {item.bet.toLocaleString()} → {item.payout.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-mono font-bold text-amber-300">
                          {item.outcome === 'LOST' ? '0.00x' : formatMinesMultiplier(item.multiplier)}
                        </div>
                        <div
                          className={`font-mono font-bold text-[11px] ${
                            item.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {item.net >= 0 ? '+' : ''}
                          {item.net.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop / Tablet Table */}
                <div className="hidden md:block w-full overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                        <th className="py-2 pr-3">Outcome</th>
                        <th className="py-2 pr-3">Mines</th>
                        <th className="py-2 pr-3">Safe Diamonds</th>
                        <th className="py-2 pr-3">Bet</th>
                        <th className="py-2 pr-3">Multiplier</th>
                        <th className="py-2 pr-3">Payout</th>
                        <th className="py-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 tabular-nums">
                      {history.slice(0, 10).map(item => (
                        <tr key={item.id} className="hover:bg-slate-900/40">
                          <td className="py-2 pr-3 font-semibold">
                            <span
                              className={
                                item.outcome === 'LOST' ? 'text-red-400' : 'text-emerald-400'
                              }
                            >
                              {item.outcome === 'LOST'
                                ? 'Mine Hit'
                                : item.outcome === 'WON'
                                ? 'Vault Cleared'
                                : 'Cashed Out'}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-300">{item.mineCount}</td>
                          <td className="py-2 pr-3 font-mono text-cyan-300">{item.safeRevealed}</td>
                          <td className="py-2 pr-3 font-mono text-slate-300">
                            {item.bet.toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 font-mono font-bold text-amber-300">
                            {item.outcome === 'LOST' ? '0.00x' : formatMinesMultiplier(item.multiplier)}
                          </td>
                          <td className="py-2 pr-3 font-mono text-slate-200">
                            {item.payout.toLocaleString()}
                          </td>
                          <td
                            className={`py-2 text-right font-mono font-bold ${
                              item.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {item.net >= 0 ? '+' : ''}
                            {item.net.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
