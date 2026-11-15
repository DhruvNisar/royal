import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  CrashRoundState,
  CrashRoundResult,
} from '../../types';
import {
  CRASH_DEFAULT_BET,
  CRASH_MIN_BET,
  CRASH_MAX_BET,
  CRASH_MAX_MULTIPLIER,
  validateCrashBet,
  validateAutoCashOut,
  generateCrashPoint,
  getCrashMultiplierAtElapsed,
  getContinuousCrashMultiplier,
  getElapsedForCrashMultiplier,
  calculateCrashPayout,
  canCashOutAtMultiplier,
  loadCrashHistory,
  saveCrashHistory,
} from './crashLogic';
import {
  useContainerSize,
  useViewportMetrics,
  getArcadeLayoutTier,
  ArcadeLayoutTier,
} from '../arcadeResponsive';
import { storageManager } from '../../services/storage';
import { soundManager } from '../../services/sound';
import { CoinCelebration } from '../../components/common/CoinCelebration';
import { InGameRuleDrawer } from '../../components/common/InGameRuleDrawer';
import {
  ArrowLeft,
  BookOpen,
  Rocket,
  DollarSign,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Flame,
} from 'lucide-react';

interface CrashGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface ActiveCrashRound {
  id: string;
  bet: number;
  crashPoint: number;
  crashTimeMs: number;
  startTimeMs: number;
  autoCashOut: number | null;
  settled: boolean;
}

function computeCrashCanvasSize(
  containerWidth: number,
  viewportHeight: number,
  tier: ArcadeLayoutTier
): { width: number; height: number } {
  const availW = Math.max(240, Math.min(880, containerWidth > 0 ? containerWidth : 340));
  const aspect = availW < 460 ? 1.38 : 1.92;
  const maxH =
    tier === 'desktop'
      ? Math.max(220, Math.min(420, viewportHeight - 310))
      : Math.max(185, Math.min(340, Math.round(viewportHeight * 0.44)));

  const naturalH = availW / aspect;
  if (naturalH > maxH) {
    const drawH = Math.floor(maxH);
    const drawW = Math.max(240, Math.floor(drawH * aspect));
    return { width: Math.min(availW, drawW), height: drawH };
  }
  return { width: Math.floor(availW), height: Math.floor(naturalH) };
}

export const CrashGame: React.FC<CrashGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  const [roundState, setRoundState] = useState<CrashRoundState>('READY');
  const [betInput, setBetInput] = useState<string>(String(CRASH_DEFAULT_BET));
  const [autoCashOutEnabled, setAutoCashOutEnabled] = useState<boolean>(false);
  const [autoCashOutInput, setAutoCashOutInput] = useState<string>('2.00');
  const [displayMultiplier, setDisplayMultiplier] = useState<number>(1.0);
  const [continuousMultiplier, setContinuousMultiplier] = useState<number>(1.0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [activeBet, setActiveBet] = useState<number>(0);
  const [lastOutcome, setLastOutcome] = useState<CrashRoundResult | null>(null);
  const [history, setHistory] = useState<CrashRoundResult[]>(() => loadCrashHistory());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  // Responsive container & viewport measurement
  const [workspaceRef, workspaceSize] = useContainerSize<HTMLDivElement>(1024, 720);
  const [chartBoxRef, chartBoxSize] = useContainerSize<HTMLDivElement>(640, 340);
  const viewport = useViewportMetrics();

  const layoutTier = getArcadeLayoutTier(workspaceSize.width);
  const chartDim = useMemo(
    () => computeCrashCanvasSize(chartBoxSize.width, viewport.vh, layoutTier),
    [chartBoxSize.width, viewport.vh, layoutTier]
  );

  // Strict ref state machine & loop guards
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const roundStateRef = useRef<CrashRoundState>('READY');
  const activeRoundRef = useRef<ActiveCrashRound | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickSoundMsRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const chartDimRef = useRef(chartDim);
  chartDimRef.current = chartDim;
  const dprRef = useRef(viewport.dpr);
  dprRef.current = viewport.dpr;
  const onUpdateProfileRef = useRef(onUpdateProfile);
  onUpdateProfileRef.current = onUpdateProfile;

  const parsedBet = useMemo(() => {
    const n = Number(betInput);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  }, [betInput]);

  const parsedAutoTarget = useMemo(() => {
    if (!autoCashOutEnabled) return null;
    const n = Number(autoCashOutInput);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }, [autoCashOutEnabled, autoCashOutInput]);

  const sessionStats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let net = 0;
    for (const h of history) {
      if (h.outcome === 'CASHED_OUT') wins++;
      else losses++;
      net += h.net;
    }
    return {
      totalBets: history.length,
      wins,
      losses,
      net,
    };
  }, [history]);

  const drawCrashGraph = useCallback(
    (curState: CrashRoundState, curElapsedSec: number, curContMult: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width: drawW, height: drawH } = chartDimRef.current;
      const dpr = dprRef.current;
      const targetPixelW = Math.max(1, Math.round(drawW * dpr));
      const targetPixelH = Math.max(1, Math.round(drawH * dpr));

      if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
        canvas.width = targetPixelW;
        canvas.height = targetPixelH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, drawW, drawH);

      // Deep space background radial
      const bgGrad = ctx.createRadialGradient(
        drawW * 0.65,
        drawH * 0.25,
        drawW * 0.05,
        drawW * 0.5,
        drawH * 0.5,
        drawW * 0.78
      );
      bgGrad.addColorStop(0, '#121b2b');
      bgGrad.addColorStop(0.65, '#080b12');
      bgGrad.addColorStop(1, '#05070b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, drawW, drawH);

      const padL = Math.max(38, Math.round(drawW * 0.082));
      const padR = Math.max(18, Math.round(drawW * 0.045));
      const padT = Math.max(18, Math.round(drawH * 0.08));
      const padB = Math.max(24, Math.round(drawH * 0.115));

      const plotW = Math.max(80, drawW - padL - padR);
      const plotH = Math.max(60, drawH - padT - padB);

      const maxTimeSec = Math.max(8, curElapsedSec * 1.15);
      const maxMult = Math.max(2.2, curContMult * 1.2);

      const toX = (sec: number) =>
        Math.min(drawW - padR, Math.max(padL, padL + (sec / maxTimeSec) * plotW));
      const toY = (mult: number) =>
        Math.min(
          drawH - padB,
          Math.max(padT, drawH - padB - ((mult - 1.0) / Math.max(0.5, maxMult - 1.0)) * plotH)
        );

      const axisFontPx = drawW < 360 ? 9 : 10;
      ctx.font = `600 ${axisFontPx}px ui-monospace, SFMono-Regular, monospace`;

      // Horizontal Grid & Y labels
      const yTicks = [1.0, 1 + (maxMult - 1) * 0.33, 1 + (maxMult - 1) * 0.66, maxMult];
      for (const val of yTicks) {
        const y = toY(val);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(drawW - padR, y);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${val.toFixed(1)}x`, padL - 6, y);
      }

      // Vertical Grid & Time labels
      const xTicks = [0, maxTimeSec * 0.25, maxTimeSec * 0.5, maxTimeSec * 0.75, maxTimeSec];
      for (const sec of xTicks) {
        const x = toX(sec);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, drawH - padB);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${sec.toFixed(1)}s`, x, drawH - padB + 6);
      }

      // Plot Axes
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, drawH - padB);
      ctx.lineTo(drawW - padR, drawH - padB);
      ctx.stroke();

      const curveColor =
        curState === 'CRASHED' ? '#ef4444' : curState === 'CASHED_OUT' ? '#fbbf24' : '#10b981';

      // Trajectory samples
      const samples = 56;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= samples; i++) {
        const s = (curElapsedSec * i) / samples;
        const m = getContinuousCrashMultiplier(s * 1000);
        pts.push({ x: toX(s), y: toY(m) });
      }

      const tip = pts[pts.length - 1] ?? { x: padL, y: drawH - padB };
      const prev = pts[Math.max(0, pts.length - 4)] ?? tip;
      const angleRad = Math.atan2(tip.y - prev.y, Math.max(0.01, tip.x - prev.x));

      if (curElapsedSec > 0 && pts.length > 1) {
        // Gradient area under curve
        const areaGrad = ctx.createLinearGradient(0, padT, 0, drawH - padB);
        areaGrad.addColorStop(
          0,
          curState === 'CRASHED'
            ? 'rgba(239, 68, 68, 0.34)'
            : curState === 'CASHED_OUT'
            ? 'rgba(251, 191, 36, 0.30)'
            : 'rgba(16, 185, 129, 0.32)'
        );
        areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.lineTo(tip.x, drawH - padB);
        ctx.lineTo(padL, drawH - padB);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Curve Stroke
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = curveColor;
        ctx.lineWidth = drawW < 400 ? 2.6 : 3.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Clamp rocket icon center cleanly inside visible canvas bounds
      const scale = Math.max(0.68, Math.min(1.05, drawW / 540));
      const rx = Math.min(drawW - padR * 0.65, Math.max(padL, tip.x));
      const ry = Math.min(drawH - padB, Math.max(padT + 8, tip.y));

      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(scale, scale);

      if (curState === 'CRASHED') {
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
        ctx.fill();

        const starPts = [
          [0, -15], [4, -5], [14, -6], [6, 2], [13, 11],
          [2, 6], [-5, 14], [-4, 4], [-15, 0], [-5, -5],
        ];
        ctx.beginPath();
        ctx.moveTo(starPts[0][0], starPts[0][1]);
        for (let i = 1; i < starPts.length; i++) {
          ctx.lineTo(starPts[i][0], starPts[i][1]);
        }
        ctx.closePath();
        ctx.fillStyle = '#fde047';
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.rotate(angleRad);

        if (curState === 'RUNNING') {
          ctx.beginPath();
          ctx.moveTo(-11, -4);
          ctx.lineTo(-24, 0);
          ctx.lineTo(-11, 4);
          ctx.closePath();
          ctx.fillStyle = 'rgba(245, 158, 11, 0.92)';
          ctx.fill();
        }

        // Rocket Fuselage
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.bezierCurveTo(8, -6, -4, -6, -11, -4);
        ctx.lineTo(-11, 4);
        ctx.bezierCurveTo(-4, 6, 8, 6, 14, 0);
        ctx.closePath();
        ctx.fillStyle = curState === 'CASHED_OUT' ? '#fde047' : '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cockpit Window
        ctx.beginPath();
        ctx.arc(3, 0, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#0ea5e9';
        ctx.fill();

        // Fins
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-7, -4);
        ctx.lineTo(-13, -9);
        ctx.lineTo(-11, -3);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-7, 4);
        ctx.lineTo(-13, 9);
        ctx.lineTo(-11, 3);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    },
    []
  );

  // Immediately re-render canvas cleanly on any resize or state update without interrupting rounds
  useEffect(() => {
    drawCrashGraph(roundState, elapsedSec, continuousMultiplier);
  }, [chartDim, viewport.dpr, roundState, elapsedSec, continuousMultiplier, drawCrashGraph]);

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const recordCrashResult = useCallback((result: CrashRoundResult) => {
    const updated = [result, ...loadCrashHistory()].slice(0, 10);
    saveCrashHistory(updated);
    if (mountedRef.current) {
      setHistory(updated);
      setLastOutcome(result);
    }
  }, []);

  const settleAsCrashed = useCallback(
    (round: ActiveCrashRound) => {
      if (round.settled || roundStateRef.current !== 'RUNNING') return;
      round.settled = true;
      roundStateRef.current = 'CRASHED';
      cancelAnimation();

      storageManager.recordGameRound('crash', false, 0);

      const result: CrashRoundResult = {
        id: round.id,
        timestamp: Date.now(),
        bet: round.bet,
        finalCrashMultiplier: round.crashPoint,
        cashOutMultiplier: null,
        payout: 0,
        net: -round.bet,
        outcome: 'CRASHED',
      };

      recordCrashResult(result);
      soundManager.playCrashExplosion();

      const finalElapsed = round.crashTimeMs / 1000;
      drawCrashGraph('CRASHED', finalElapsed, round.crashPoint);

      if (mountedRef.current) {
        setDisplayMultiplier(round.crashPoint);
        setContinuousMultiplier(round.crashPoint);
        setElapsedSec(finalElapsed);
        setRoundState('CRASHED');
        onUpdateProfileRef.current();
      }
    },
    [cancelAnimation, drawCrashGraph, recordCrashResult]
  );

  const settleAsCashedOut = useCallback(
    (round: ActiveCrashRound, acceptedMultiplier: number) => {
      if (round.settled || roundStateRef.current !== 'RUNNING') return;
      if (!canCashOutAtMultiplier(acceptedMultiplier, round.crashPoint)) {
        settleAsCrashed(round);
        return;
      }

      round.settled = true;
      roundStateRef.current = 'CASHED_OUT';
      cancelAnimation();

      const payout = calculateCrashPayout(round.bet, acceptedMultiplier);
      if (payout > 0) {
        storageManager.executeTransaction(
          'win',
          'crash',
          payout,
          `Crash Cash-Out @ ${acceptedMultiplier.toFixed(2)}x`
        );
      }
      storageManager.recordGameRound('crash', payout > round.bet, payout);

      const result: CrashRoundResult = {
        id: round.id,
        timestamp: Date.now(),
        bet: round.bet,
        finalCrashMultiplier: round.crashPoint,
        cashOutMultiplier: acceptedMultiplier,
        payout,
        net: payout - round.bet,
        outcome: 'CASHED_OUT',
      };

      recordCrashResult(result);

      if (acceptedMultiplier >= 3) {
        soundManager.playBigWin();
      } else {
        soundManager.playCrashCashOut();
      }

      const settledElapsed = getElapsedForCrashMultiplier(acceptedMultiplier) / 1000;
      drawCrashGraph('CASHED_OUT', settledElapsed, acceptedMultiplier);

      if (mountedRef.current) {
        setDisplayMultiplier(acceptedMultiplier);
        setContinuousMultiplier(acceptedMultiplier);
        setElapsedSec(settledElapsed);
        setRoundState('CASHED_OUT');
        if (acceptedMultiplier >= 2) {
          setCelebrateWin(true);
        }
        onUpdateProfileRef.current();
      }
    },
    [cancelAnimation, drawCrashGraph, recordCrashResult, settleAsCrashed]
  );

  const runFlightLoop = useCallback(
    (now: number) => {
      if (!mountedRef.current) return;
      const round = activeRoundRef.current;
      if (!round || round.settled || roundStateRef.current !== 'RUNNING') {
        rafRef.current = null;
        return;
      }

      const elapsedMs = Math.max(0, now - round.startTimeMs);

      if (elapsedMs >= round.crashTimeMs) {
        if (
          round.autoCashOut !== null &&
          canCashOutAtMultiplier(round.autoCashOut, round.crashPoint)
        ) {
          settleAsCashedOut(round, round.autoCashOut);
        } else {
          settleAsCrashed(round);
        }
        return;
      }

      const currentMult = getCrashMultiplierAtElapsed(elapsedMs);
      const contMult = getContinuousCrashMultiplier(elapsedMs);

      if (
        round.autoCashOut !== null &&
        currentMult >= round.autoCashOut &&
        canCashOutAtMultiplier(round.autoCashOut, round.crashPoint)
      ) {
        settleAsCashedOut(round, round.autoCashOut);
        return;
      }

      if (now - lastTickSoundMsRef.current >= 260) {
        lastTickSoundMsRef.current = now;
        soundManager.playCrashTick(currentMult);
      }

      const sec = elapsedMs / 1000;
      drawCrashGraph('RUNNING', sec, contMult);
      setDisplayMultiplier(currentMult);
      setContinuousMultiplier(contMult);
      setElapsedSec(sec);

      rafRef.current = requestAnimationFrame(runFlightLoop);
    },
    [drawCrashGraph, settleAsCashedOut, settleAsCrashed]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimation();
    };
  }, [cancelAnimation]);

  const handlePlaceBetAndLaunch = () => {
    if (roundStateRef.current !== 'READY') return;

    const currentProfile = storageManager.getProfile();
    const betCheck = validateCrashBet(parsedBet, currentProfile.coins);
    if (!betCheck.valid) {
      setErrorMsg(betCheck.error || 'Invalid wager.');
      return;
    }

    const autoCheck = validateAutoCashOut(parsedAutoTarget);
    if (!autoCheck.valid) {
      setErrorMsg(autoCheck.error || 'Invalid auto cash-out multiplier.');
      return;
    }

    let crashPoint: number;
    try {
      crashPoint = generateCrashPoint();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to generate crash round.');
      return;
    }

    const tx = storageManager.executeTransaction(
      'bet',
      'crash',
      parsedBet,
      `Rocket Crash Wager: ${parsedBet} coins`
    );
    if (!tx.success) {
      setErrorMsg(tx.error || 'Insufficient coins.');
      return;
    }

    setErrorMsg(null);
    onUpdateProfileRef.current();

    const round: ActiveCrashRound = {
      id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      bet: parsedBet,
      crashPoint,
      crashTimeMs: getElapsedForCrashMultiplier(crashPoint),
      startTimeMs: performance.now(),
      autoCashOut: parsedAutoTarget,
      settled: false,
    };

    activeRoundRef.current = round;
    setActiveBet(parsedBet);
    setLastOutcome(null);

    if (crashPoint <= 1.0) {
      roundStateRef.current = 'RUNNING';
      settleAsCrashed(round);
      return;
    }

    roundStateRef.current = 'RUNNING';
    lastTickSoundMsRef.current = performance.now();
    soundManager.playCrashLaunch();
    setDisplayMultiplier(1.0);
    setContinuousMultiplier(1.0);
    setElapsedSec(0);
    setRoundState('RUNNING');

    rafRef.current = requestAnimationFrame(runFlightLoop);
  };

  const handleManualCashOut = () => {
    const round = activeRoundRef.current;
    if (roundStateRef.current !== 'RUNNING' || !round || round.settled) return;

    const elapsedMs = Math.max(0, performance.now() - round.startTimeMs);
    if (elapsedMs >= round.crashTimeMs) {
      settleAsCrashed(round);
      return;
    }

    const acceptedMult = getCrashMultiplierAtElapsed(elapsedMs);
    if (!canCashOutAtMultiplier(acceptedMult, round.crashPoint)) {
      settleAsCrashed(round);
      return;
    }

    settleAsCashedOut(round, acceptedMult);
  };

  const handleResetNextRound = () => {
    if (roundStateRef.current === 'RUNNING') return;
    soundManager.playButtonClick();
    activeRoundRef.current = null;
    roundStateRef.current = 'READY';
    setRoundState('READY');
    setDisplayMultiplier(1.0);
    setContinuousMultiplier(1.0);
    setElapsedSec(0);
    setActiveBet(0);
    setErrorMsg(null);
  };

  const adjustBet = (next: number) => {
    if (roundState !== 'READY') return;
    soundManager.playChipClick();
    const clamped = Math.max(CRASH_MIN_BET, Math.min(CRASH_MAX_BET, Math.floor(next)));
    setBetInput(String(clamped));
    setErrorMsg(null);
  };

  const liveCashOutValue = useMemo(() => {
    if (roundState !== 'RUNNING' || activeBet <= 0) return 0;
    return calculateCrashPayout(activeBet, displayMultiplier);
  }, [roundState, activeBet, displayMultiplier]);

  const isSideBySide = layoutTier === 'desktop';
  const isTabletCompact = layoutTier === 'tablet_compact';

  return (
    <div className="w-full max-w-full min-w-0 box-border min-h-[calc(100dvh-65px)] bg-[#08090d] text-slate-100 flex flex-col overflow-x-clip pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      <InGameRuleDrawer
        gameId="crash"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Top Bar */}
      <div className="w-full max-w-full min-w-0 box-border bg-[#12151f]/95 border-b border-slate-800 px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onBackToLobby();
            }}
            className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif font-black tracking-wider text-amber-300 uppercase truncate text-sm sm:text-base leading-tight">
              Rocket Crash
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate leading-tight">
              97% RTP Inverse Curve · Max {CRASH_MAX_MULTIPLIER.toLocaleString()}x
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundManager.playButtonClick();
            setShowRulesDrawer(true);
          }}
          className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="text-xs">Rules</span>
        </button>
      </div>

      {/* Main Responsive Workspace */}
      <div
        ref={workspaceRef}
        className="w-full max-w-[1440px] min-w-0 box-border mx-auto px-2.5 sm:px-5 lg:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5 flex-1"
      >
        <div
          className={`w-full min-w-0 flex gap-4 sm:gap-5 items-start ${
            isSideBySide ? 'flex-row' : 'flex-col'
          }`}
        >
          {/* GRAPH PANEL: Top on mobile/tablet, Right on desktop */}
          <div
            className={`w-full min-w-0 ${
              isSideBySide ? 'order-2 flex-1' : 'order-1'
            } space-y-3 sm:space-y-4`}
          >
            <div className="w-full min-w-0 box-border bg-[#0c1018] border border-amber-500/25 rounded-2xl p-2.5 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3">
              {/* Graph Header + State */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs px-0.5">
                <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Local Crypto RNG · Pre-Flight Point</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] sm:text-[11px] font-bold uppercase shrink-0 ${
                    roundState === 'RUNNING'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : roundState === 'CASHED_OUT'
                      ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      : roundState === 'CRASHED'
                      ? 'bg-red-950 text-red-300 border border-red-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {roundState === 'CASHED_OUT' ? 'CASHED OUT' : roundState}
                </span>
              </div>

              {/* Previous Crash Multipliers Strip (Readable across all devices) */}
              {history.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-0.5">
                    Previous:
                  </span>
                  {history.slice(0, 8).map(item => (
                    <span
                      key={item.id}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border ${
                        item.finalCrashMultiplier >= 10
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : item.finalCrashMultiplier >= 2
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                          : 'bg-red-950/70 text-red-300 border-red-800/70'
                      }`}
                    >
                      {item.finalCrashMultiplier.toFixed(2)}x
                    </span>
                  ))}
                </div>
              )}

              {/* Responsive HiDPI Trajectory Canvas Container */}
              <div
                ref={chartBoxRef}
                className="relative w-full min-w-0 rounded-xl bg-[#070a10] border border-slate-800/90 overflow-hidden flex items-center justify-center"
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: `${chartDim.width}px`, height: `${chartDim.height}px` }}
                  className="block max-w-full select-none"
                  aria-label="Rocket Crash Multiplier Trajectory"
                />

                {/* Multiplier & Outcome HUD Overlay (bounded cleanly inside chart) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-4 py-2 text-center">
                  <div
                    style={{ fontSize: 'clamp(1.85rem, 5.5vw, 3.6rem)' }}
                    className={`font-mono font-black tracking-tight leading-none tabular-nums drop-shadow-lg ${
                      roundState === 'CRASHED'
                        ? 'text-red-400'
                        : roundState === 'CASHED_OUT'
                        ? 'text-amber-300'
                        : roundState === 'RUNNING'
                        ? 'text-emerald-300'
                        : 'text-slate-200'
                    }`}
                  >
                    {displayMultiplier.toFixed(2)}x
                  </div>

                  {roundState === 'READY' && (
                    <div className="mt-1.5 text-[11px] sm:text-xs text-slate-300/90 font-medium bg-black/45 px-2.5 py-0.5 rounded-lg">
                      Place wager &amp; launch when ready
                    </div>
                  )}

                  {roundState === 'RUNNING' && (
                    <div className="mt-1.5 text-[11px] sm:text-sm text-emerald-300 font-bold tabular-nums bg-black/55 px-3 py-0.5 rounded-lg border border-emerald-500/30">
                      Payout: {liveCashOutValue.toLocaleString()} coins
                    </div>
                  )}

                  {roundState === 'CASHED_OUT' && lastOutcome && (
                    <div className="mt-1.5 max-w-[92%] px-3 py-1 rounded-xl bg-amber-950/90 border border-amber-400/50 text-amber-200 text-[11px] sm:text-xs font-bold tabular-nums">
                      Cashed {lastOutcome.cashOutMultiplier?.toFixed(2)}x · +
                      {lastOutcome.payout.toLocaleString()} coins
                    </div>
                  )}

                  {roundState === 'CRASHED' && lastOutcome && (
                    <div className="mt-1.5 max-w-[92%] px-3 py-1 rounded-xl bg-red-950/90 border border-red-500/50 text-red-200 text-[11px] sm:text-xs font-bold tabular-nums inline-flex items-center justify-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>
                        Crashed @ {lastOutcome.finalCrashMultiplier.toFixed(2)}x (-
                        {lastOutcome.bet.toLocaleString()})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CONTROL PANEL: Below graph on mobile/tablet, Left sidebar on desktop */}
          <div
            className={`min-w-0 box-border bg-[#11141d] border border-slate-800 rounded-2xl p-3 sm:p-5 shadow-xl ${
              isSideBySide
                ? 'order-1 w-[clamp(300px,32%,380px)] shrink-0'
                : 'order-2 w-full'
            }`}
          >
            <div
              className={`w-full min-w-0 grid gap-4 ${
                isTabletCompact ? 'grid-cols-2 items-start' : 'grid-cols-1'
              }`}
            >
              {/* Column 1: Bet Amount + Primary Action (Launch / CASH OUT / Next Round) */}
              <div className="w-full min-w-0 space-y-3.5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <label
                      htmlFor="crash-bet-input"
                      className="font-semibold text-slate-300 uppercase tracking-wider"
                    >
                      Bet Amount
                    </label>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {CRASH_MIN_BET} – {CRASH_MAX_BET.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      disabled={roundState !== 'READY'}
                      onClick={() => adjustBet(parsedBet - 10)}
                      aria-label="Decrease bet"
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base shrink-0"
                    >
                      -
                    </button>
                    <input
                      id="crash-bet-input"
                      type="number"
                      min={CRASH_MIN_BET}
                      max={CRASH_MAX_BET}
                      step={10}
                      disabled={roundState !== 'READY'}
                      value={betInput}
                      onChange={e => {
                        setBetInput(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="flex-1 min-w-0 min-h-[44px] bg-[#090b10] border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-center font-mono font-bold text-amber-300 text-base tabular-nums outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={roundState !== 'READY'}
                      onClick={() => adjustBet(parsedBet + 10)}
                      aria-label="Increase bet"
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base shrink-0"
                    >
                      +
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={roundState !== 'READY'}
                      onClick={() => adjustBet(Math.max(CRASH_MIN_BET, Math.floor(parsedBet / 2)))}
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                    >
                      1/2
                    </button>
                    <button
                      type="button"
                      disabled={roundState !== 'READY'}
                      onClick={() => adjustBet(Math.min(CRASH_MAX_BET, parsedBet * 2))}
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                    >
                      2x
                    </button>
                    <button
                      type="button"
                      disabled={roundState !== 'READY'}
                      onClick={() =>
                        adjustBet(Math.min(CRASH_MAX_BET, Math.max(CRASH_MIN_BET, profile.coins)))
                      }
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-semibold text-xs whitespace-nowrap"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Error Notice */}
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="min-w-0 break-words">{errorMsg}</span>
                  </div>
                )}

                {/* State-Driven Action Buttons (Large Mobile-Friendly Touch Targets) */}
                {roundState === 'READY' && (
                  <button
                    type="button"
                    onClick={handlePlaceBetAndLaunch}
                    disabled={
                      parsedBet < CRASH_MIN_BET ||
                      parsedBet > CRASH_MAX_BET ||
                      parsedBet > profile.coins
                    }
                    className="w-full min-h-[50px] px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Rocket className="w-4 h-4 shrink-0" />
                    <span className="truncate">Place Bet &amp; Launch</span>
                  </button>
                )}

                {roundState === 'RUNNING' && (
                  <button
                    type="button"
                    onClick={handleManualCashOut}
                    className="w-full min-h-[54px] px-3 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-serif font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/30 transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5 shrink-0" />
                    <span className="tabular-nums truncate">
                      CASH OUT ({liveCashOutValue.toLocaleString()})
                    </span>
                  </button>
                )}

                {(roundState === 'CASHED_OUT' || roundState === 'CRASHED') && (
                  <button
                    type="button"
                    onClick={handleResetNextRound}
                    className="w-full min-h-[50px] px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>Next Round</span>
                  </button>
                )}
              </div>

              {/* Column 2: Auto Cash-Out + Session Stats */}
              <div className="w-full min-w-0 space-y-3.5">
                <div className="p-3 rounded-xl bg-[#0b0d14] border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="crash-auto-toggle"
                      className="text-xs font-semibold text-slate-200 cursor-pointer"
                    >
                      Auto Cash-Out Target
                    </label>
                    <input
                      id="crash-auto-toggle"
                      type="checkbox"
                      disabled={roundState !== 'READY'}
                      checked={autoCashOutEnabled}
                      onChange={e => {
                        soundManager.playButtonClick();
                        setAutoCashOutEnabled(e.target.checked);
                        setErrorMsg(null);
                      }}
                      className="w-5 h-5 accent-amber-500 rounded cursor-pointer disabled:opacity-50 shrink-0"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1.01}
                        max={CRASH_MAX_MULTIPLIER}
                        step={0.1}
                        disabled={!autoCashOutEnabled || roundState !== 'READY'}
                        value={autoCashOutInput}
                        onChange={e => {
                          setAutoCashOutInput(e.target.value);
                          setErrorMsg(null);
                        }}
                        aria-label="Auto cash out multiplier"
                        className="w-20 min-h-[40px] bg-[#08090d] border border-slate-700 focus:border-amber-500 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-amber-300 text-xs tabular-nums outline-none disabled:opacity-40"
                      />
                      <span className="text-xs text-slate-400 font-mono">x</span>
                    </div>

                    <div className="flex-1 min-w-[140px] grid grid-cols-3 gap-1">
                      {['1.50', '2.00', '5.00'].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          disabled={!autoCashOutEnabled || roundState !== 'READY'}
                          onClick={() => setAutoCashOutInput(preset)}
                          className="min-h-[40px] py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-35 text-[11px] font-mono text-slate-300 whitespace-nowrap"
                        >
                          {preset}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Session Stats Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#0b0d14] border border-slate-800/80">
                    <div className="text-[10px] uppercase text-slate-400">Total Bets</div>
                    <div className="font-mono font-bold text-slate-200 text-sm tabular-nums">
                      {sessionStats.totalBets}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0b0d14] border border-slate-800/80">
                    <div className="text-[10px] uppercase text-slate-400">Wins / Losses</div>
                    <div className="font-mono font-bold text-sm tabular-nums">
                      <span className="text-emerald-400">{sessionStats.wins}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-red-400">{sessionStats.losses}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest 10 Crash Rounds (Full Width below, adapts from mobile cards to table) */}
        <div className="w-full min-w-0 box-border bg-[#11141d] border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif font-bold text-sm sm:text-base text-slate-100">
              Latest 10 Crash Rounds
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  saveCrashHistory([]);
                  setHistory([]);
                  setLastOutcome(null);
                }}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              No Crash rounds played yet. Launch your first flight above.
            </div>
          ) : layoutTier === 'mobile' ? (
            <div className="space-y-2">
              {history.map(item => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-[#0b0e15] border border-slate-800/80 flex items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.outcome === 'CASHED_OUT'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                            : 'bg-red-950 text-red-300 border border-red-700/50'
                        }`}
                      >
                        {item.outcome === 'CASHED_OUT' ? 'Cashed' : 'Crashed'}
                      </span>
                      <span className="font-mono text-slate-300">
                        Crash {item.finalCrashMultiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Bet {item.bet.toLocaleString()} → {item.payout.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-amber-300">
                      {item.cashOutMultiplier !== null
                        ? `${item.cashOutMultiplier.toFixed(2)}x`
                        : '—'}
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
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Crash Point</th>
                    <th className="py-2 pr-3">Cash Out</th>
                    <th className="py-2 pr-3">Bet</th>
                    <th className="py-2 pr-3">Payout</th>
                    <th className="py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.outcome === 'CASHED_OUT'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                              : 'bg-red-950 text-red-300 border border-red-700/50'
                          }`}
                        >
                          {item.outcome === 'CASHED_OUT' ? 'Cashed Out' : 'Crashed'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono font-bold text-slate-300">
                        {item.finalCrashMultiplier.toFixed(2)}x
                      </td>
                      <td className="py-2 pr-3 font-mono text-amber-300">
                        {item.cashOutMultiplier !== null ? `${item.cashOutMultiplier.toFixed(2)}x` : '—'}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-300">{item.bet.toLocaleString()}</td>
                      <td className="py-2 pr-3 font-mono text-slate-200">{item.payout.toLocaleString()}</td>
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
          )}
        </div>
      </div>
    </div>
  );
};
