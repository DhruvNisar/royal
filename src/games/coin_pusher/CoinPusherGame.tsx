import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  UserProfile,
  CoinPusherState,
  CoinPusherRoundResult,
} from '../../types';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  COIN_PUSHER_MIN_BET,
  COIN_PUSHER_MAX_BET,
  COIN_PUSHER_QUICK_BETS,
  COIN_PUSHER_OUTCOMES,
} from './coinPusherMath';
import {
  CoinPusherDropPlan,
  createCoinPusherDropPlan,
  validateCoinPusherBet,
  loadCoinPusherHistory,
  saveCoinPusherHistory,
  calculateCoinPusherStats,
} from './coinPusherLogic';
import { CoinPusherCabinet } from './CoinPusherCabinet';
import {
  ArrowLeft,
  BookOpen,
  History,
  Volume2,
  VolumeX,
  Coins,
  Sparkles,
  X,
  ArrowDownCircle,
} from 'lucide-react';

interface CoinPusherGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

export const CoinPusherGame: React.FC<CoinPusherGameProps> = ({
  profile,
  onUpdateProfile,
  onOpenRules,
  onBackToLobby,
}) => {
  const [betInput, setBetInput] = useState<string>('50');
  const [betError, setBetError] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<number>(3);
  const [gameState, setGameState] = useState<CoinPusherState>('READY');

  const [activePlan, setActivePlan] = useState<CoinPusherDropPlan | null>(null);
  const [lastSettledPlan, setLastSettledPlan] = useState<CoinPusherDropPlan | null>(null);

  const [history, setHistory] = useState<CoinPusherRoundResult[]>(() => loadCoinPusherHistory());
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showRuleDrawer, setShowRuleDrawer] = useState<boolean>(false);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(() => soundManager.getSettings().sfxEnabled);

  // Strict single-deduction, single-settlement & unmount safety refs
  const activePlanRef = useRef<CoinPusherDropPlan | null>(null);
  const deductedRoundIdsRef = useRef<Set<string>>(new Set());
  const settledRoundIdsRef = useRef<Set<string>>(new Set());
  const isDropLockedRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const celebrationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activePlanRef.current = null;
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const parsedBet = useMemo(() => {
    const n = Number(betInput);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }, [betInput]);

  const stats = useMemo(() => calculateCoinPusherStats(history), [history]);

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

  const handleDropCoin = () => {
    if (isDropLockedRef.current || gameState === 'DROPPING') return;

    const latestBalance = storageManager.getProfile().coins;
    const validation = validateCoinPusherBet(parsedBet, latestBalance);
    if (!validation.valid) {
      setBetError(validation.error ?? 'Invalid wager.');
      soundManager.playLoss();
      return;
    }

    const idBuf = new Uint32Array(1);
    crypto.getRandomValues(idBuf);
    const roundId = `cp_${Date.now()}_${idBuf[0].toString(36)}`;
    if (deductedRoundIdsRef.current.has(roundId)) return;

    // Step 1: Generate & lock complete outcome BEFORE animation starts
    const dropPlan = createCoinPusherDropPlan(roundId, parsedBet, selectedLane);

    // Step 2: Deduct bet EXACTLY ONCE
    const deductRes = storageManager.executeTransaction(
      'bet',
      'coin_pusher',
      dropPlan.bet,
      `Royal Coin Pusher — Lane ${dropPlan.lane} Drop (${dropPlan.bet.toLocaleString()} coins)`
    );

    if (!deductRes.success) {
      setBetError(deductRes.error ?? 'Insufficient virtual coin balance.');
      soundManager.playLoss();
      return;
    }

    deductedRoundIdsRef.current.add(roundId);
    isDropLockedRef.current = true;
    activePlanRef.current = dropPlan;

    setBetError(null);
    setShowCelebration(false);
    setActivePlan(dropPlan);
    setGameState('DROPPING');
    soundManager.playCoinPusherDrop();
    onUpdateProfile();
  };

  // Called once when canvas finishes playing the locked drop choreography
  const handleDropAnimationComplete = useCallback(
    (roundId: string) => {
      if (!mountedRef.current) return;
      const plan = activePlanRef.current;
      if (!plan || plan.roundId !== roundId) return;
      if (settledRoundIdsRef.current.has(roundId)) return;

      settledRoundIdsRef.current.add(roundId);
      activePlanRef.current = null;

      // Credit gross payout EXACTLY ONCE (gross payout already includes original stake)
      if (plan.grossPayout > 0) {
        storageManager.executeTransaction(
          'win',
          'coin_pusher',
          plan.grossPayout,
          `Royal Coin Pusher — ${plan.outcomeLabel} (${plan.multiplier.toFixed(2)}x)`
        );
      }

      const isNetWin = plan.netProfit > 0;
      storageManager.recordGameRound('coin_pusher', isNetWin, plan.grossPayout);
      storageManager.incrementAchievementProgress('pusher_veteran', 1);
      if (plan.outcome === 'BIG_PRIZE') {
        storageManager.updateAchievementProgress('pusher_first_big', 1);
      }

      const record: CoinPusherRoundResult = {
        id: plan.roundId,
        timestamp: Date.now(),
        bet: plan.bet,
        lane: plan.lane,
        outcome: plan.outcome,
        outcomeLabel: plan.outcomeLabel,
        multiplier: plan.multiplier,
        grossPayout: plan.grossPayout,
        netProfit: plan.netProfit,
      };

      setHistory(prev => {
        const next = [record, ...prev].slice(0, 50);
        saveCoinPusherHistory(next);
        return next;
      });

      setLastSettledPlan(plan);
      setActivePlan(null);
      setGameState('SETTLED');
      isDropLockedRef.current = false;
      onUpdateProfile();

      if (plan.outcome === 'BIG_PRIZE') {
        soundManager.playCoinPusherBigAvalanche();
        setShowCelebration(true);
        if (celebrationTimerRef.current !== null) {
          window.clearTimeout(celebrationTimerRef.current);
        }
        celebrationTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) setShowCelebration(false);
        }, 2800);
      } else if (plan.outcome === 'NORMAL_PRIZE') {
        soundManager.playWin();
      } else if (plan.outcome === 'SMALL_PRIZE') {
        soundManager.playChipClick();
      } else {
        soundManager.playLoss();
      }
    },
    [onUpdateProfile]
  );

  const handleQuickBet = (amount: number) => {
    soundManager.playChipClick();
    setBetError(null);
    setBetInput(String(Math.min(COIN_PUSHER_MAX_BET, amount)));
  };

  const handleAdjustBet = (mode: 'half' | 'double' | 'max') => {
    soundManager.playButtonClick();
    setBetError(null);
    const current = Math.max(COIN_PUSHER_MIN_BET, parsedBet || COIN_PUSHER_MIN_BET);
    if (mode === 'half') {
      setBetInput(String(Math.max(COIN_PUSHER_MIN_BET, Math.floor(current / 2))));
    } else if (mode === 'double') {
      setBetInput(String(Math.min(COIN_PUSHER_MAX_BET, Math.min(profile.coins, current * 2))));
    } else {
      setBetInput(String(Math.max(COIN_PUSHER_MIN_BET, Math.min(COIN_PUSHER_MAX_BET, profile.coins))));
    }
  };

  const isDropping = gameState === 'DROPPING';

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
                activePlanRef.current = null;
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
                ROYAL COIN PUSHER
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate hidden sm:block">
                5 Drop Lanes · Live Arcade Pusher · 95% RTP
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
              aria-label="View coin pusher history and stats"
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
              aria-label="Open coin pusher rules"
              className="p-2 sm:px-3 rounded-xl bg-[#161923] hover:bg-[#1e2230] border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[38px]"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5 items-start">
          {/* LEFT: 2.5D Arcade Coin Pusher Cabinet */}
          <div className="min-w-0 max-w-[660px] w-full mx-auto lg:mx-0 lg:max-w-none space-y-3">
            <CoinPusherCabinet
              selectedLane={selectedLane}
              onSelectLane={setSelectedLane}
              activePlan={activePlan}
              lastSettledPlan={lastSettledPlan}
              isDropping={isDropping}
              onDropAnimationComplete={handleDropAnimationComplete}
            />

            {/* Current Round Result Banner */}
            <div className="rounded-2xl bg-[#11131b] border border-slate-800 p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#161923] border border-slate-800/80 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Round Result</div>
                  <div
                    className={`font-serif font-bold text-xs sm:text-sm mt-0.5 truncate ${
                      isDropping
                        ? 'text-amber-300'
                        : lastSettledPlan?.outcome === 'BIG_PRIZE'
                          ? 'text-amber-300'
                          : lastSettledPlan?.outcome === 'NORMAL_PRIZE'
                            ? 'text-emerald-300'
                            : lastSettledPlan?.outcome === 'SMALL_PRIZE'
                              ? 'text-sky-300'
                              : 'text-slate-400'
                    }`}
                  >
                    {isDropping
                      ? 'Dropping…'
                      : lastSettledPlan
                        ? `${lastSettledPlan.outcomeLabel} (${lastSettledPlan.multiplier.toFixed(2)}×)`
                        : 'Ready'}
                  </div>
                </div>

                <div className="rounded-xl bg-[#161923] border border-slate-800/80 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Gross Payout</div>
                  <div className="font-mono font-bold text-xs sm:text-sm text-amber-300 tabular-nums mt-0.5">
                    {isDropping
                      ? '—'
                      : lastSettledPlan
                        ? `${lastSettledPlan.grossPayout.toLocaleString()}`
                        : '0'}
                  </div>
                </div>

                <div className="rounded-xl bg-[#161923] border border-slate-800/80 p-2">
                  <div className="text-[10px] text-slate-400 uppercase">Net Profit / Loss</div>
                  <div
                    className={`font-mono font-bold text-xs sm:text-sm tabular-nums mt-0.5 ${
                      isDropping || !lastSettledPlan
                        ? 'text-slate-400'
                        : lastSettledPlan.netProfit > 0
                          ? 'text-emerald-400'
                          : lastSettledPlan.netProfit < 0
                            ? 'text-rose-400'
                            : 'text-slate-200'
                    }`}
                  >
                    {isDropping || !lastSettledPlan
                      ? '—'
                      : `${lastSettledPlan.netProfit > 0 ? '+' : ''}${lastSettledPlan.netProfit.toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Drop Controls + Paytable + Recent Drops */}
          <div className="min-w-0 space-y-3 sm:space-y-4">
            {/* Bet & Drop Panel */}
            <div className="rounded-2xl bg-[#11131b] border border-amber-500/25 p-3.5 sm:p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif font-bold text-sm text-amber-200 uppercase tracking-wider">
                  Bet Per Drop
                </h2>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {COIN_PUSHER_MIN_BET}–{COIN_PUSHER_MAX_BET.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <Coins className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="number"
                      min={COIN_PUSHER_MIN_BET}
                      max={COIN_PUSHER_MAX_BET}
                      step={10}
                      disabled={isDropping}
                      value={betInput}
                      onChange={e => {
                        setBetError(null);
                        setBetInput(e.target.value);
                      }}
                      aria-label="Bet per drop in virtual coins"
                      className="w-full bg-[#171a25] border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono font-bold text-slate-100 outline-none disabled:opacity-50 tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isDropping}
                    onClick={() => handleAdjustBet('half')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 min-h-[42px]"
                  >
                    ½
                  </button>
                  <button
                    type="button"
                    disabled={isDropping}
                    onClick={() => handleAdjustBet('double')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-slate-300 disabled:opacity-40 min-h-[42px]"
                  >
                    2×
                  </button>
                  <button
                    type="button"
                    disabled={isDropping}
                    onClick={() => handleAdjustBet('max')}
                    className="px-2.5 py-2.5 rounded-xl bg-[#191c28] hover:bg-[#232737] border border-slate-800 text-xs font-bold text-amber-300 disabled:opacity-40 min-h-[42px]"
                  >
                    Max
                  </button>
                </div>

                {/* Quick Bet Buttons */}
                <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-1.5">
                  {COIN_PUSHER_QUICK_BETS.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      disabled={isDropping}
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

              {betError && (
                <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/35 rounded-xl px-3 py-2">
                  {betError}
                </div>
              )}

              {/* Primary DROP COIN Button */}
              <button
                type="button"
                disabled={isDropping}
                onClick={handleDropCoin}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-60 text-slate-950 font-serif font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2 min-h-[48px]"
              >
                <ArrowDownCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {isDropping
                    ? `Dropping Lane ${selectedLane}…`
                    : `Drop Coin · Lane ${selectedLane} (${(parsedBet > 0 ? parsedBet : 0).toLocaleString()})`}
                </span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                <span>95.00% Exact RTP · Local crypto RNG</span>
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

            {/* Exact Outcome Paytable */}
            <div className="rounded-2xl bg-[#11131b] border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold text-slate-200 uppercase tracking-wider">
                  Prize Outcomes &amp; Odds
                </h3>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                  95% RTP
                </span>
              </div>
              <div className="space-y-1.5">
                {COIN_PUSHER_OUTCOMES.map(tier => {
                  const previewPayout = Math.round(
                    Math.max(COIN_PUSHER_MIN_BET, parsedBet) * tier.multiplier
                  );
                  const isHighlighted =
                    !isDropping && lastSettledPlan?.outcome === tier.category;
                  return (
                    <div
                      key={tier.category}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-xs transition-colors ${
                        isHighlighted
                          ? 'bg-amber-500/15 border-amber-400/60'
                          : 'bg-[#161923] border-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {tier.category === 'BIG_PRIZE' && (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span
                          className={`font-semibold truncate ${
                            tier.category === 'BIG_PRIZE'
                              ? 'text-amber-300'
                              : tier.category === 'NORMAL_PRIZE'
                                ? 'text-emerald-300'
                                : tier.category === 'SMALL_PRIZE'
                                  ? 'text-sky-300'
                                  : 'text-slate-400'
                          }`}
                        >
                          {tier.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono tabular-nums shrink-0">
                        <span className="text-[11px] text-slate-400">{tier.weightPercent}%</span>
                        <span className="font-bold text-slate-100 w-11 text-right">
                          {tier.multiplier.toFixed(2)}×
                        </span>
                        <span className="text-[11px] text-amber-300 w-14 text-right">
                          {previewPayout.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Gross multiplier includes your original stake. Lane selection is visual and preserves exact published probabilities.
              </p>
            </div>

            {/* Recent Drops */}
            <div className="rounded-2xl bg-[#11131b] border border-slate-800 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-serif font-bold text-slate-200 uppercase tracking-wider">
                  Recent Drops
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setShowHistoryModal(true);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Stats ({stats.dropsPlayed})
                </button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">No drops recorded yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {history.slice(0, 4).map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#161923] border border-slate-800/70 text-xs"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-semibold text-slate-200">{item.outcomeLabel}</span>
                        <span className="text-slate-500 text-[10px] ml-1.5 font-mono">
                          L{item.lane} · {item.bet.toLocaleString()}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          item.netProfit > 0
                            ? 'text-emerald-400'
                            : item.netProfit < 0
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }`}
                      >
                        {item.netProfit > 0 ? '+' : ''}
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
                  Royal Coin Pusher — History &amp; Stats
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Drops</div>
                  <div className="font-mono font-bold text-base text-slate-100 tabular-nums">
                    {stats.dropsPlayed}
                  </div>
                </div>
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Big Prizes</div>
                  <div className="font-mono font-bold text-base text-amber-300 tabular-nums">
                    {stats.bigPrizeCount}
                  </div>
                </div>
                <div className="rounded-xl bg-[#161923] border border-slate-800 p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase">Biggest Payout</div>
                  <div className="font-mono font-bold text-base text-emerald-300 tabular-nums">
                    {stats.biggestPayout.toLocaleString()}
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

              {history.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Drop your first coin to build your arcade history.
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
                          {item.outcomeLabel} ({item.multiplier.toFixed(2)}×) · Lane {item.lane}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(item.timestamp).toLocaleString()} · Bet {item.bet.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-slate-200 font-bold">
                          Payout: {item.grossPayout.toLocaleString()}
                        </div>
                        <div
                          className={
                            item.netProfit > 0
                              ? 'text-emerald-400'
                              : item.netProfit < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                          }
                        >
                          Net: {item.netProfit > 0 ? '+' : ''}
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
        gameId="coin_pusher"
        isOpen={showRuleDrawer}
        onClose={() => setShowRuleDrawer(false)}
      />
    </div>
  );
};
