import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  UserProfile,
  PlinkoRiskLevel,
  PlinkoRowCount,
  PlinkoRoundResult,
} from '../../types';
import {
  PLINKO_DEFAULT_BET,
  PLINKO_MIN_BET,
  PLINKO_MAX_BET,
  PLINKO_ROW_OPTIONS,
  PLINKO_RISK_OPTIONS,
  getPlinkoPayoutTable,
  getPlinkoProbabilities,
  calculatePlinkoRTP,
  validatePlinkoBet,
  generatePlinkoOutcome,
  loadPlinkoHistory,
  savePlinkoHistory,
  PlinkoDropOutcome,
} from './plinkoLogic';
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
  Play,
  Square,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface PlinkoGameProps {
  profile: UserProfile;
  onUpdateProfile: () => void;
  onOpenRules: () => void;
  onBackToLobby: () => void;
}

interface ActiveBall {
  id: string;
  bet: number;
  rows: PlinkoRowCount;
  risk: PlinkoRiskLevel;
  outcome: PlinkoDropOutcome;
  startTime: number;
  stepDurationMs: number;
  leadInMs: number;
  dropOutMs: number;
  lastBouncedRow: number;
  settled: boolean;
  isAuto: boolean;
}

interface AutoDropStats {
  totalPlanned: number;
  completed: number;
  wagered: number;
  returned: number;
  stopReason: string | null;
}

interface BoardMetrics {
  drawW: number;
  drawH: number;
  centerX: number;
  dx: number;
  dy: number;
  startDropY: number;
  firstRowY: number;
  lastRowY: number;
  slotY: number;
  slotHeight: number;
  slotBoxWidth: number;
  pegRadius: number;
  ballRadius: number;
}

function computePlinkoCanvasSize(
  containerWidth: number,
  viewportHeight: number,
  tier: ArcadeLayoutTier
): { width: number; height: number } {
  const availW = Math.max(240, Math.min(780, containerWidth > 0 ? containerWidth : 340));
  const aspect = availW < 460 ? 1.04 : 1.3;
  const maxH =
    tier === 'desktop'
      ? Math.max(280, Math.min(540, viewportHeight - 285))
      : Math.max(220, Math.min(460, Math.round(viewportHeight * 0.54)));

  const naturalH = availW / aspect;
  if (naturalH > maxH) {
    const drawH = Math.floor(maxH);
    const drawW = Math.max(240, Math.floor(drawH * aspect));
    return { width: Math.min(availW, drawW), height: drawH };
  }
  return { width: Math.floor(availW), height: Math.floor(naturalH) };
}

function computeBoardMetrics(drawW: number, drawH: number, rows: PlinkoRowCount): BoardMetrics {
  const centerX = drawW / 2;
  const padX = drawW < 440 ? Math.max(4, Math.round(drawW * 0.014)) : Math.max(8, Math.round(drawW * 0.025));
  const usableW = Math.max(180, drawW - padX * 2);
  const dx = usableW / (rows + 1.06);

  const startDropY = Math.max(10, Math.round(drawH * 0.038));
  const slotHeight = Math.max(28, Math.min(44, Math.round(drawH * 0.108)));
  const slotY = drawH - slotHeight - Math.max(6, Math.round(drawH * 0.02));
  const firstRowY = startDropY + Math.max(18, Math.round(drawH * 0.08));
  const lastRowY = slotY - Math.max(16, Math.round(drawH * 0.068));
  const dy = rows > 1 ? (lastRowY - firstRowY) / (rows - 1) : 32;

  const pegRadius = Math.max(2.3, Math.min(5.8, dx * 0.145));
  const ballRadius = Math.max(4.2, Math.min(9.6, dx * 0.255));
  const slotBoxWidth = Math.max(12, dx * 0.92);

  return {
    drawW,
    drawH,
    centerX,
    dx,
    dy,
    startDropY,
    firstRowY,
    lastRowY,
    slotY,
    slotHeight,
    slotBoxWidth,
    pegRadius,
    ballRadius,
  };
}

function getPegPosition(row: number, col: number, m: BoardMetrics): { x: number; y: number } {
  const pegCount = row + 3;
  const x = m.centerX + (col - (pegCount - 1) / 2) * m.dx;
  const y = m.firstRowY + row * m.dy;
  return { x, y };
}

function getSlotX(slotIndex: number, rows: PlinkoRowCount, m: BoardMetrics): number {
  return m.centerX + (slotIndex - rows / 2) * m.dx;
}

function getSlotColorClass(multiplier: number): string {
  if (multiplier >= 50) return 'from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-yellow-200';
  if (multiplier >= 10) return 'from-orange-500 to-red-600 text-white border-orange-300';
  if (multiplier >= 3) return 'from-amber-500 to-orange-600 text-slate-950 border-amber-300';
  if (multiplier >= 1) return 'from-emerald-600 to-emerald-800 text-emerald-50 border-emerald-400';
  return 'from-slate-800 to-slate-900 text-slate-300 border-slate-600';
}

function getSlotCanvasStyle(multiplier: number): { fill: string; stroke: string; text: string } {
  if (multiplier >= 50) return { fill: '#f59e0b', stroke: '#fef08a', text: '#090b10' };
  if (multiplier >= 10) return { fill: '#dc2626', stroke: '#fca5a5', text: '#ffffff' };
  if (multiplier >= 3) return { fill: '#d97706', stroke: '#fde68a', text: '#ffffff' };
  if (multiplier >= 1) return { fill: '#059669', stroke: '#6ee7b7', text: '#ffffff' };
  return { fill: '#1e293b', stroke: '#475569', text: '#cbd5e1' };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatSlotCanvasLabel(mult: number, boxWidth: number): string {
  if (mult >= 100) return `${Math.round(mult)}x`;
  if (mult >= 10) {
    return boxWidth < 30 ? `${Math.round(mult)}x` : `${Number(mult.toFixed(1))}x`;
  }
  return `${Number(mult.toFixed(1))}x`;
}

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  profile,
  onUpdateProfile,
  onBackToLobby,
}) => {
  const [betInput, setBetInput] = useState<string>(String(PLINKO_DEFAULT_BET));
  const [rows, setRows] = useState<PlinkoRowCount>(12);
  const [risk, setRisk] = useState<PlinkoRiskLevel>('MEDIUM');
  const [history, setHistory] = useState<PlinkoRoundResult[]>(() => loadPlinkoHistory());
  const [lastResult, setLastResult] = useState<PlinkoRoundResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [celebrateWin, setCelebrateWin] = useState<boolean>(false);
  const [showRulesDrawer, setShowRulesDrawer] = useState<boolean>(false);

  const [activeDropCount, setActiveDropCount] = useState<number>(0);
  const [highlightedSlot, setHighlightedSlot] = useState<{ index: number; until: number } | null>(null);

  // Auto-Drop state
  const [autoCountInput, setAutoCountInput] = useState<string>('10');
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [autoStats, setAutoStats] = useState<AutoDropStats | null>(null);
  const [payoutExpandedOverride, setPayoutExpandedOverride] = useState<boolean | null>(null);

  // Responsive container & viewport measurement
  const viewport = useViewportMetrics();
  const [workspaceRef, workspaceSize] = useContainerSize<HTMLDivElement>(
    Math.min(1440, viewport.vw),
    720
  );
  const [boardBoxRef, boardBoxSize] = useContainerSize<HTMLDivElement>(
    Math.min(640, Math.max(280, viewport.vw - 32)),
    480
  );

  const layoutTier = getArcadeLayoutTier(workspaceSize.width);
  const canvasDim = useMemo(
    () => computePlinkoCanvasSize(boardBoxSize.width, viewport.vh, layoutTier),
    [boardBoxSize.width, viewport.vh, layoutTier]
  );

  // Refs for atomic animation, settlement, resize resilience & auto-drop loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeBallsRef = useRef<ActiveBall[]>([]);
  const rafRef = useRef<number | null>(null);
  const pulsingPegRef = useRef<{ key: string; until: number } | null>(null);
  const highlightedSlotRef = useRef<{ index: number; until: number } | null>(null);
  const canvasDimRef = useRef(canvasDim);
  canvasDimRef.current = canvasDim;
  const dprRef = useRef(viewport.dpr);
  dprRef.current = viewport.dpr;

  const autoRunningRef = useRef<boolean>(false);
  const autoStopRequestedRef = useRef<boolean>(false);
  const autoTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const onUpdateProfileRef = useRef(onUpdateProfile);
  onUpdateProfileRef.current = onUpdateProfile;

  const parsedBet = useMemo(() => {
    const num = Number(betInput);
    return Number.isFinite(num) ? Math.floor(num) : 0;
  }, [betInput]);

  const payoutTable = useMemo(() => getPlinkoPayoutTable(rows, risk), [rows, risk]);
  const slotProbabilities = useMemo(() => getPlinkoProbabilities(rows), [rows]);
  const calculatedRtp = useMemo(() => calculatePlinkoRTP(rows, payoutTable), [rows, payoutTable]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const payoutTableRef = useRef(payoutTable);
  payoutTableRef.current = payoutTable;

  const settleBall = useCallback((ball: ActiveBall, isCleanup = false) => {
    if (ball.settled) return;
    ball.settled = true;

    const { outcome, bet, rows: ballRows, risk: ballRisk } = ball;

    if (outcome.payout > 0) {
      storageManager.executeTransaction(
        'win',
        'plinko',
        outcome.payout,
        `Plinko ${ballRows}R ${ballRisk} (${outcome.multiplier.toFixed(2)}x)`
      );
    }

    storageManager.recordGameRound('plinko', outcome.net > 0, outcome.payout);

    const record: PlinkoRoundResult = {
      id: ball.id,
      timestamp: Date.now(),
      bet,
      rows: ballRows,
      risk: ballRisk,
      slotIndex: outcome.slotIndex,
      multiplier: outcome.multiplier,
      payout: outcome.payout,
      net: outcome.net,
    };

    const existing = loadPlinkoHistory();
    const updatedHistory = [record, ...existing].slice(0, 10);
    savePlinkoHistory(updatedHistory);

    if (isCleanup || !mountedRef.current) {
      return;
    }

    const slotHighlight = { index: outcome.slotIndex, until: performance.now() + 550 };
    highlightedSlotRef.current = slotHighlight;
    setHighlightedSlot(slotHighlight);
    setHistory(updatedHistory);
    setLastResult(record);

    if (ball.isAuto) {
      setAutoStats(prev =>
        prev
          ? {
              ...prev,
              completed: prev.completed + 1,
              returned: prev.returned + outcome.payout,
            }
          : prev
      );
    }

    if (outcome.multiplier >= 5) {
      soundManager.playBigWin();
      setCelebrateWin(true);
    } else {
      soundManager.playPlinkoLand(outcome.net > 0);
    }

    onUpdateProfileRef.current();
  }, []);

  const computeBallPositionAtTime = useCallback(
    (
      ball: ActiveBall,
      now: number,
      m: BoardMetrics
    ): {
      x: number;
      y: number;
      finished: boolean;
      hitPegKey: string | null;
      hitRow: number;
    } => {
      const elapsed = Math.max(0, now - ball.startTime);
      const { path } = ball.outcome;
      const ballRows = ball.rows;
      const bounceOffset = m.pegRadius + m.ballRadius * 0.72;

      // 1. Lead-in drop from top chute onto Row 0 center peg
      if (elapsed < ball.leadInMs) {
        const u = elapsed / ball.leadInMs;
        const eased = u * u;
        const firstPeg = getPegPosition(0, 1, m);
        return {
          x: firstPeg.x,
          y: m.startDropY + (firstPeg.y - bounceOffset - m.startDropY) * eased,
          finished: false,
          hitPegKey: null,
          hitRow: -1,
        };
      }

      const bounceElapsed = elapsed - ball.leadInMs;
      const totalBounceMs = ballRows * ball.stepDurationMs;

      // 2. Peg-by-peg parabolic bounces matching exact predetermined path
      if (bounceElapsed < totalBounceMs) {
        const stepFloat = bounceElapsed / ball.stepDurationMs;
        const stepIndex = Math.min(ballRows - 1, Math.floor(stepFloat));
        const u = stepFloat - stepIndex;

        let rightSoFar = 0;
        for (let i = 0; i < stepIndex; i++) {
          rightSoFar += path[i];
        }

        const startPegPos = getPegPosition(stepIndex, rightSoFar + 1, m);
        const hitPegKey = u < 0.25 ? `${stepIndex}_${rightSoFar + 1}` : null;

        const startX = startPegPos.x;
        const startY = startPegPos.y - bounceOffset;

        const moveDir = path[stepIndex] === 1 ? 1 : -1;
        const endX = startX + moveDir * (m.dx * 0.5);

        let endY: number;
        if (stepIndex < ballRows - 1) {
          const nextPeg = getPegPosition(stepIndex + 1, rightSoFar + path[stepIndex] + 1, m);
          endY = nextPeg.y - bounceOffset;
        } else {
          endY = m.lastRowY + Math.max(8, m.dy * 0.36);
        }

        const arcHeight = Math.min(10, Math.max(4, (endY - startY) * 0.28));
        const x = startX + (endX - startX) * u;
        const y = startY + (endY - startY) * (u * u) - arcHeight * Math.sin(Math.PI * u);

        return {
          x,
          y,
          finished: false,
          hitPegKey,
          hitRow: stepIndex,
        };
      }

      // 3. Final drop into target slot pocket
      const dropElapsed = bounceElapsed - totalBounceMs;
      const targetX = getSlotX(ball.outcome.slotIndex, ballRows, m);
      if (dropElapsed < ball.dropOutMs) {
        const u = dropElapsed / ball.dropOutMs;
        const startDropOutY = m.lastRowY + Math.max(8, m.dy * 0.36);
        const targetY = m.slotY + m.slotHeight * 0.42;
        return {
          x: targetX,
          y: startDropOutY + (targetY - startDropOutY) * (u * u),
          finished: false,
          hitPegKey: null,
          hitRow: ballRows,
        };
      }

      return {
        x: targetX,
        y: m.slotY + m.slotHeight * 0.42,
        finished: true,
        hitPegKey: null,
        hitRow: ballRows,
      };
    },
    []
  );

  const drawBoardFrame = useCallback(
    (now: number, ballPositions: { x: number; y: number }[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width: drawW, height: drawH } = canvasDimRef.current;
      const dpr = dprRef.current;
      const targetPixelW = Math.max(1, Math.round(drawW * dpr));
      const targetPixelH = Math.max(1, Math.round(drawH * dpr));

      if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
        canvas.width = targetPixelW;
        canvas.height = targetPixelH;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, drawW, drawH);

      const curRows = rowsRef.current;
      const curTable = payoutTableRef.current;
      const m = computeBoardMetrics(drawW, drawH, curRows);

      // Background subtle radial spotlight
      const bgGrad = ctx.createRadialGradient(
        m.centerX,
        drawH * 0.22,
        drawW * 0.05,
        m.centerX,
        drawH * 0.5,
        drawW * 0.72
      );
      bgGrad.addColorStop(0, '#142824');
      bgGrad.addColorStop(0.65, '#090d14');
      bgGrad.addColorStop(1, '#06080c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, drawW, drawH);

      // Top Chute Triangle
      const chuteSize = Math.max(6, Math.min(10, drawW * 0.018));
      ctx.beginPath();
      ctx.moveTo(m.centerX - chuteSize, 6);
      ctx.lineTo(m.centerX + chuteSize, 6);
      ctx.lineTo(m.centerX, 6 + chuteSize * 1.15);
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fill();

      // Pegs
      const activePegKey =
        pulsingPegRef.current && pulsingPegRef.current.until > now
          ? pulsingPegRef.current.key
          : null;

      for (let r = 0; r < curRows; r++) {
        const count = r + 3;
        for (let c = 0; c < count; c++) {
          const pos = getPegPosition(r, c, m);
          const isPulsing = activePegKey === `${r}_${c}`;
          if (isPulsing) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, m.pegRadius * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(pos.x, pos.y, m.pegRadius, 0, Math.PI * 2);
          ctx.fillStyle = isPulsing ? '#fde047' : '#e2e8f0';
          ctx.fill();
          ctx.lineWidth = Math.max(0.8, m.pegRadius * 0.24);
          ctx.strokeStyle = isPulsing ? '#f59e0b' : '#475569';
          ctx.stroke();
        }
      }

      // Bottom Multiplier Slots
      const activeSlot =
        highlightedSlotRef.current && highlightedSlotRef.current.until > now
          ? highlightedSlotRef.current.index
          : -1;

      const radius = Math.min(6, m.slotBoxWidth * 0.22);
      const baseFontPx = Math.max(8.2, Math.min(12.5, m.slotBoxWidth * 0.42));

      for (let idx = 0; idx < curTable.length; idx++) {
        const mult = curTable[idx];
        const sx = getSlotX(idx, curRows, m) - m.slotBoxWidth / 2;
        const isHit = activeSlot === idx;
        const sy = isHit ? m.slotY + 3 : m.slotY;
        const style = getSlotCanvasStyle(mult);

        drawRoundedRect(ctx, sx, sy, m.slotBoxWidth, m.slotHeight, radius);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = isHit ? 2.2 : 1;
        ctx.strokeStyle = isHit ? '#fef08a' : style.stroke;
        ctx.stroke();

        // Compact non-clipping centered label inside equal-width slot
        let label = formatSlotCanvasLabel(mult, m.slotBoxWidth);
        let fontSize = baseFontPx;
        const fontStack = 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.font = `700 ${fontSize}px ${fontStack}`;
        const maxTextW = Math.max(8, m.slotBoxWidth - 2.5);
        let measured = ctx.measureText(label).width;
        if (measured > maxTextW && measured > 0) {
          const scaled = fontSize * (maxTextW / measured);
          if (scaled < 7 && label.endsWith('x')) {
            label = label.slice(0, -1);
            fontSize = Math.max(7, Math.min(baseFontPx, fontSize * (maxTextW / Math.max(1, ctx.measureText(label).width))));
          } else {
            fontSize = Math.max(6.8, scaled);
          }
          ctx.font = `700 ${fontSize}px ${fontStack}`;
        }
        ctx.fillStyle = style.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sx + m.slotBoxWidth / 2, sy + m.slotHeight / 2 + 0.5);
      }

      // Active Falling Balls
      for (const bp of ballPositions) {
        ctx.save();
        ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
        ctx.shadowBlur = Math.max(6, m.ballRadius * 1.4);

        const ballGrad = ctx.createRadialGradient(
          bp.x - m.ballRadius * 0.3,
          bp.y - m.ballRadius * 0.3,
          m.ballRadius * 0.15,
          bp.x,
          bp.y,
          m.ballRadius
        );
        ballGrad.addColorStop(0, '#fef08a');
        ballGrad.addColorStop(0.55, '#f59e0b');
        ballGrad.addColorStop(1, '#b45309');

        ctx.beginPath();
        ctx.arc(bp.x, bp.y, m.ballRadius, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = '#fef9c3';
        ctx.stroke();
        ctx.restore();
      }
    },
    []
  );

  // Redraw immediately whenever dimensions, rows, risk, or slot highlight changes
  useEffect(() => {
    const now = performance.now();
    const m = computeBoardMetrics(canvasDim.width, canvasDim.height, rows);
    const positions = activeBallsRef.current.map(b => {
      const p = computeBallPositionAtTime(b, now, m);
      return { x: p.x, y: p.y };
    });
    drawBoardFrame(now, positions);
  }, [canvasDim, viewport.dpr, rows, risk, payoutTable, highlightedSlot, computeBallPositionAtTime, drawBoardFrame]);

  const startAnimationLoop = useCallback(() => {
    if (rafRef.current !== null) return;

    const tick = (now: number) => {
      if (!mountedRef.current) return;

      const { width: drawW, height: drawH } = canvasDimRef.current;
      const remaining: ActiveBall[] = [];
      const positions: { x: number; y: number }[] = [];

      for (const ball of activeBallsRef.current) {
        const m = computeBoardMetrics(drawW, drawH, ball.rows);
        const pos = computeBallPositionAtTime(ball, now, m);

        if (pos.hitRow >= 0 && pos.hitRow > ball.lastBouncedRow && pos.hitRow < ball.rows) {
          ball.lastBouncedRow = pos.hitRow;
          soundManager.playPlinkoBounce(pos.hitRow, ball.rows);
        }
        if (pos.hitPegKey) {
          pulsingPegRef.current = { key: pos.hitPegKey, until: now + 110 };
        }

        if (pos.finished) {
          settleBall(ball, false);
        } else {
          remaining.push(ball);
          positions.push({ x: pos.x, y: pos.y });
        }
      }

      activeBallsRef.current = remaining;
      setActiveDropCount(remaining.length);
      drawBoardFrame(now, positions);

      if (remaining.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        // Brief fade frame for slot highlight
        window.setTimeout(() => {
          if (mountedRef.current && activeBallsRef.current.length === 0) {
            drawBoardFrame(performance.now(), []);
          }
        }, 580);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [computeBallPositionAtTime, drawBoardFrame, settleBall]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      autoStopRequestedRef.current = true;
      autoRunningRef.current = false;
      if (autoTimeoutRef.current !== null) {
        window.clearTimeout(autoTimeoutRef.current);
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      for (const ball of activeBallsRef.current) {
        settleBall(ball, true);
      }
      activeBallsRef.current = [];
    };
  }, [settleBall]);

  const spawnDrop = useCallback(
    (betAmount: number, targetRows: PlinkoRowCount, targetRisk: PlinkoRiskLevel, isAuto: boolean): { ok: boolean; durationMs: number } => {
      const currentProfile = storageManager.getProfile();
      const validation = validatePlinkoBet(betAmount, currentProfile.coins);
      if (!validation.valid) {
        setErrorMsg(validation.error || 'Invalid wager.');
        return { ok: false, durationMs: 0 };
      }

      let outcome: PlinkoDropOutcome;
      try {
        outcome = generatePlinkoOutcome(betAmount, targetRows, targetRisk);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to generate drop.');
        return { ok: false, durationMs: 0 };
      }

      const tx = storageManager.executeTransaction(
        'bet',
        'plinko',
        betAmount,
        `Plinko Drop (${targetRows}R ${targetRisk}): ${betAmount} coins`
      );
      if (!tx.success) {
        setErrorMsg(tx.error || 'Transaction failed.');
        return { ok: false, durationMs: 0 };
      }

      setErrorMsg(null);
      onUpdateProfileRef.current();
      soundManager.playPlinkoDrop();

      const stepDurationMs = isAuto
        ? Math.max(75, Math.round(920 / targetRows))
        : Math.max(90, Math.round(1150 / targetRows));
      const leadInMs = isAuto ? 110 : 140;
      const dropOutMs = isAuto ? 95 : 120;
      const totalDurationMs = leadInMs + targetRows * stepDurationMs + dropOutMs;

      const ball: ActiveBall = {
        id: `plk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        bet: betAmount,
        rows: targetRows,
        risk: targetRisk,
        outcome,
        startTime: performance.now(),
        stepDurationMs,
        leadInMs,
        dropOutMs,
        lastBouncedRow: -1,
        settled: false,
        isAuto,
      };

      activeBallsRef.current = [...activeBallsRef.current, ball];
      setActiveDropCount(activeBallsRef.current.length);
      startAnimationLoop();

      return { ok: true, durationMs: totalDurationMs };
    },
    [startAnimationLoop]
  );

  const handleManualDrop = () => {
    if (isAutoRunning) return;
    soundManager.playButtonClick();
    spawnDrop(parsedBet, rows, risk, false);
  };

  const finishAutoLoop = useCallback((reason: string | null) => {
    autoRunningRef.current = false;
    autoStopRequestedRef.current = false;
    if (autoTimeoutRef.current !== null) {
      window.clearTimeout(autoTimeoutRef.current);
      autoTimeoutRef.current = null;
    }
    if (mountedRef.current) {
      setIsAutoRunning(false);
      setAutoStats(prev => (prev ? { ...prev, stopReason: reason } : prev));
    }
  }, []);

  const handleStartAuto = () => {
    if (autoRunningRef.current || activeBallsRef.current.length > 0) return;

    const plannedCount = Math.floor(Number(autoCountInput));
    if (!Number.isFinite(plannedCount) || plannedCount < 1 || plannedCount > 500) {
      setErrorMsg('Auto-drop count must be between 1 and 500.');
      return;
    }

    const currentProfile = storageManager.getProfile();
    const validation = validatePlinkoBet(parsedBet, currentProfile.coins);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Invalid wager.');
      return;
    }

    soundManager.playButtonClick();
    setErrorMsg(null);
    autoRunningRef.current = true;
    autoStopRequestedRef.current = false;
    setIsAutoRunning(true);
    setAutoStats({
      totalPlanned: plannedCount,
      completed: 0,
      wagered: 0,
      returned: 0,
      stopReason: null,
    });

    const lockedRows = rows;
    const lockedRisk = risk;
    const lockedBet = parsedBet;
    let remainingDrops = plannedCount;

    const runStep = () => {
      if (!mountedRef.current || !autoRunningRef.current) return;

      if (autoStopRequestedRef.current) {
        finishAutoLoop('Stopped by player');
        return;
      }

      if (remainingDrops <= 0) {
        finishAutoLoop('Completed all scheduled drops');
        return;
      }

      const freshProfile = storageManager.getProfile();
      if (freshProfile.coins < lockedBet) {
        finishAutoLoop('Stopped: insufficient virtual coin balance');
        return;
      }

      const dropRes = spawnDrop(lockedBet, lockedRows, lockedRisk, true);
      if (!dropRes.ok) {
        finishAutoLoop('Stopped due to wager error');
        return;
      }

      remainingDrops -= 1;
      setAutoStats(prev =>
        prev
          ? {
              ...prev,
              wagered: prev.wagered + lockedBet,
            }
          : prev
      );

      autoTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current || !autoRunningRef.current) return;
        if (autoStopRequestedRef.current) {
          finishAutoLoop('Stopped by player');
          return;
        }
        if (remainingDrops <= 0) {
          finishAutoLoop('Completed all scheduled drops');
          return;
        }
        runStep();
      }, dropRes.durationMs + 160);
    };

    runStep();
  };

  const handleStopAuto = () => {
    if (!autoRunningRef.current) return;
    soundManager.playButtonClick();
    autoStopRequestedRef.current = true;
    setAutoStats(prev => (prev ? { ...prev, stopReason: 'Stopping after current drop...' } : prev));
  };

  const adjustBet = (next: number) => {
    if (isAutoRunning) return;
    soundManager.playChipClick();
    const clamped = Math.max(PLINKO_MIN_BET, Math.min(PLINKO_MAX_BET, Math.floor(next)));
    setBetInput(String(clamped));
    setErrorMsg(null);
  };

  const isBoardLocked = activeDropCount > 0 || isAutoRunning;
  const isSideBySide = layoutTier === 'desktop';
  const isTabletCompact = layoutTier === 'tablet_compact';
  const isPayoutExpanded =
    payoutExpandedOverride !== null ? payoutExpandedOverride : layoutTier !== 'mobile';
  const highlightedSlotIdx = highlightedSlot?.index ?? -1;

  return (
    <div className="w-full max-w-full min-w-0 box-border min-h-[calc(100dvh-65px)] bg-[#08090d] text-slate-100 flex flex-col overflow-x-clip pb-[max(1rem,env(safe-area-inset-bottom))]">
      <CoinCelebration active={celebrateWin} onComplete={() => setCelebrateWin(false)} />

      <InGameRuleDrawer
        gameId="plinko"
        isOpen={showRulesDrawer}
        onClose={() => setShowRulesDrawer(false)}
      />

      {/* Top Game Bar */}
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
              Royal Plinko
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate leading-tight">
              {rows} Rows · {risk} · {(calculatedRtp * 100).toFixed(2)}% RTP
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

      {/* Main Responsive Workspace (measured directly via ResizeObserver) */}
      <div
        ref={workspaceRef}
        className="w-full max-w-[1440px] min-w-0 box-border mx-auto px-2 sm:px-5 lg:px-6 py-2.5 sm:py-5 space-y-4 sm:space-y-5 flex-1"
      >
        <div
          className={`w-full min-w-0 flex gap-3 sm:gap-5 items-start ${
            isSideBySide ? 'flex-row' : 'flex-col'
          }`}
        >
          {/* BOARD PANEL: Top on mobile/tablet, Right on desktop */}
          <div
            className={`w-full min-w-0 ${
              isSideBySide ? 'order-2 flex-1' : 'order-1'
            } space-y-3 sm:space-y-4`}
          >
            <div className="w-full min-w-0 box-border bg-[#0c1018] border border-amber-500/25 rounded-2xl p-2 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3">
              {/* Board Status Strip */}
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] sm:text-xs px-0.5 min-w-0">
                <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">Local Crypto RNG · Binomial</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
                  <span className="text-slate-400">
                    RTP: <strong className="text-amber-300">{(calculatedRtp * 100).toFixed(2)}%</strong>
                  </span>
                  {lastResult && (
                    <span
                      className={`font-bold ${
                        lastResult.net >= 0 ? 'text-emerald-400' : 'text-slate-300'
                      }`}
                    >
                      Last: {lastResult.multiplier.toFixed(2)}x ({lastResult.net >= 0 ? '+' : ''}
                      {lastResult.net.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>

              {/* Recent Multipliers Bar (visible on all screen sizes) */}
              {history.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Recent:</span>
                  {history.slice(0, 6).map(item => (
                    <span
                      key={item.id}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums border ${
                        item.multiplier >= 5
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : item.multiplier >= 1
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      {item.multiplier.toFixed(2)}x
                    </span>
                  ))}
                </div>
              )}

              {/* Responsive HiDPI Plinko Canvas Container */}
              <div
                ref={boardBoxRef}
                className="w-full min-w-0 rounded-xl bg-[#070a10] border border-slate-800/90 overflow-hidden flex items-center justify-center"
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: `${canvasDim.width}px`, height: `${canvasDim.height}px` }}
                  className="block max-w-full select-none"
                  aria-label="Royal Plinko Peg Board"
                />
              </div>

              {/* Collapsible Responsive CSS Grid Payout Table (No Horizontal Scrolling) */}
              <div className="plinko-payout-table w-full max-w-full min-w-0 pt-1 border-t border-slate-800/80 space-y-2.5 overflow-x-clip">
                <button
                  type="button"
                  aria-expanded={isPayoutExpanded}
                  aria-controls="plinko-payout-grid"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setPayoutExpandedOverride(!isPayoutExpanded);
                  }}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#10141f] hover:bg-[#151a28] border border-slate-800 flex items-center justify-between gap-2 text-left transition-colors"
                >
                  <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-amber-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>PAYOUT TABLE</span>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {rows} Rows · {risk} Risk · {rows + 1} Slots
                    </span>
                  </div>

                  <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 shrink-0 whitespace-nowrap">
                    <span>{isPayoutExpanded ? 'Collapse' : 'Expand'}</span>
                    {isPayoutExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </span>
                </button>

                {isPayoutExpanded && (
                  <div
                    id="plinko-payout-grid"
                    className="w-full max-w-full min-w-0 grid grid-cols-3 min-[380px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-9 gap-1.5"
                  >
                    {payoutTable.map((mult, idx) => {
                      const probPct = slotProbabilities[idx] * 100;
                      const probLabel =
                        probPct < 0.1
                          ? `${probPct.toFixed(3)}%`
                          : probPct < 1
                          ? `${probPct.toFixed(2)}%`
                          : `${probPct.toFixed(1)}%`;
                      return (
                        <div
                          key={idx}
                          className={`min-w-0 px-1.5 py-1.5 rounded-lg border bg-gradient-to-b text-center flex flex-col items-center justify-center overflow-hidden ${getSlotColorClass(
                            mult
                          )} ${highlightedSlotIdx === idx ? 'ring-2 ring-yellow-300' : ''}`}
                        >
                          <div className="text-[9px] opacity-75 font-mono leading-none mb-0.5">
                            #{idx + 1}
                          </div>
                          <div className="font-mono font-black text-[11px] sm:text-xs tabular-nums leading-tight">
                            {mult.toFixed(2)}x
                          </div>
                          <div className="text-[9px] opacity-85 font-mono tabular-nums leading-tight mt-0.5">
                            {probLabel}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CONTROL PANEL: Below board on mobile/tablet, Left sidebar on desktop */}
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
              {/* Column 1 (or Top on Mobile): Bet + Primary DROP */}
              <div className="w-full min-w-0 space-y-3.5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <label
                      htmlFor="plinko-bet-input"
                      className="font-semibold text-slate-300 uppercase tracking-wider"
                    >
                      Bet Amount
                    </label>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {PLINKO_MIN_BET} – {PLINKO_MAX_BET.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={() => adjustBet(parsedBet - 10)}
                      aria-label="Decrease bet"
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base transition-colors shrink-0"
                    >
                      -
                    </button>
                    <input
                      id="plinko-bet-input"
                      type="number"
                      min={PLINKO_MIN_BET}
                      max={PLINKO_MAX_BET}
                      step={10}
                      disabled={isAutoRunning}
                      value={betInput}
                      onChange={e => {
                        setBetInput(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="flex-1 min-w-0 min-h-[44px] bg-[#090b10] border border-slate-700 focus:border-amber-500 rounded-xl px-2.5 py-2 text-center font-mono font-bold text-amber-300 text-base tabular-nums outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={() => adjustBet(parsedBet + 10)}
                      aria-label="Increase bet"
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-base transition-colors shrink-0"
                    >
                      +
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={() => adjustBet(Math.max(PLINKO_MIN_BET, Math.floor(parsedBet / 2)))}
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                    >
                      1/2
                    </button>
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={() => adjustBet(Math.min(PLINKO_MAX_BET, parsedBet * 2))}
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold text-xs whitespace-nowrap"
                    >
                      2x
                    </button>
                    <button
                      type="button"
                      disabled={isAutoRunning}
                      onClick={() =>
                        adjustBet(Math.min(PLINKO_MAX_BET, Math.max(PLINKO_MIN_BET, profile.coins)))
                      }
                      className="min-h-[40px] py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-semibold text-xs whitespace-nowrap"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* Error Alert */}
                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="min-w-0 break-words">{errorMsg}</span>
                  </div>
                )}

                {/* Primary DROP Button */}
                <button
                  type="button"
                  onClick={handleManualDrop}
                  disabled={
                    isAutoRunning ||
                    parsedBet < PLINKO_MIN_BET ||
                    parsedBet > PLINKO_MAX_BET ||
                    parsedBet > profile.coins
                  }
                  className="w-full min-h-[48px] px-3 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-serif font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="truncate">DROP BALL ({parsedBet.toLocaleString()})</span>
                </button>
              </div>

              {/* Column 2 (or Bottom on Mobile): Risk + Rows + Auto-Drop */}
              <div className="w-full min-w-0 space-y-3.5">
                {/* Risk Selector */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider">
                      Risk Level
                    </span>
                    {isBoardLocked && (
                      <span className="text-[10px] text-amber-400">Locked in flight</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PLINKO_RISK_OPTIONS.map(opt => {
                      const selected = risk === opt;
                      const activeStyle =
                        opt === 'LOW'
                          ? 'bg-emerald-600 text-white border-emerald-400'
                          : opt === 'MEDIUM'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-red-600 text-white border-red-400';
                      return (
                        <button
                          key={opt}
                          type="button"
                          disabled={isBoardLocked}
                          onClick={() => {
                            soundManager.playButtonClick();
                            setRisk(opt);
                          }}
                          className={`min-h-[40px] py-2 px-1 rounded-xl border text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap disabled:opacity-50 ${
                            selected
                              ? activeStyle
                              : 'bg-[#0b0d14] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider">
                      Peg Rows
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{rows + 1} Slots</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PLINKO_ROW_OPTIONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        disabled={isBoardLocked}
                        onClick={() => {
                          soundManager.playButtonClick();
                          setRows(r);
                        }}
                        className={`min-h-[38px] py-1.5 rounded-lg border text-xs font-mono font-bold tabular-nums transition-all disabled:opacity-50 ${
                          rows === r
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm shadow-amber-500/20'
                            : 'bg-[#0b0d14] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-Drop Panel */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wider text-slate-300">
                      Auto-Drop Mode
                    </span>
                    <span className="text-[11px] text-slate-400">Sequential</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={500}
                      disabled={isAutoRunning}
                      value={autoCountInput}
                      onChange={e => setAutoCountInput(e.target.value)}
                      className="w-16 min-h-[40px] bg-[#090b10] border border-slate-700 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-slate-100 text-xs tabular-nums outline-none disabled:opacity-50 shrink-0"
                      aria-label="Auto drop count"
                    />
                    <div className="flex-1 min-w-[140px] grid grid-cols-4 gap-1">
                      {[5, 10, 25, 50].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          disabled={isAutoRunning}
                          onClick={() => setAutoCountInput(String(preset))}
                          className={`min-h-[40px] py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-colors disabled:opacity-40 ${
                            autoCountInput === String(preset)
                              ? 'bg-slate-700 text-amber-300 border-amber-500/50'
                              : 'bg-[#0b0d14] text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!isAutoRunning ? (
                    <button
                      type="button"
                      onClick={handleStartAuto}
                      disabled={
                        isBoardLocked || parsedBet < PLINKO_MIN_BET || parsedBet > profile.coins
                      }
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Start Auto ({autoCountInput || 0} Drops)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopAuto}
                      className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-red-600/20"
                    >
                      <Square className="w-3.5 h-3.5 shrink-0" />
                      <span>Stop Auto</span>
                    </button>
                  )}

                  {autoStats && (
                    <div className="p-2.5 rounded-xl bg-[#0b0e15] border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Remaining</span>
                        <span className="font-mono font-bold text-slate-200 tabular-nums">
                          {autoStats.completed}/{autoStats.totalPlanned} (
                          {Math.max(0, autoStats.totalPlanned - autoStats.completed)} left)
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Wagered / Back</span>
                        <span className="font-mono text-slate-200 tabular-nums">
                          {autoStats.wagered.toLocaleString()} / {autoStats.returned.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Auto Net</span>
                        <span
                          className={`font-mono font-bold tabular-nums ${
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
                        <div className="text-[11px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                          {autoStats.stopReason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest 10 Drops History (Full Width below, adapts seamlessly from cards on mobile to table on tablet/desktop) */}
        <div className="w-full min-w-0 box-border bg-[#11141d] border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif font-bold text-sm sm:text-base text-slate-100">
              Latest 10 Plinko Drops
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  savePlinkoHistory([]);
                  setHistory([]);
                  setLastResult(null);
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
              No Plinko drops recorded yet. Select your bet, rows, and risk level to drop your first ball.
            </div>
          ) : layoutTier === 'mobile' ? (
            <div className="space-y-2">
              {history.map(item => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-[#0b0e15] border border-slate-800/80 flex items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-slate-200 truncate">
                      {item.rows}R · {item.risk} · Slot #{item.slotIndex + 1}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Bet {item.bet.toLocaleString()} → {item.payout.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-amber-300">
                      {item.multiplier.toFixed(2)}x
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
                    <th className="py-2 pr-3">Config</th>
                    <th className="py-2 pr-3">Slot</th>
                    <th className="py-2 pr-3">Bet</th>
                    <th className="py-2 pr-3">Mult</th>
                    <th className="py-2 pr-3">Payout</th>
                    <th className="py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 tabular-nums">
                  {history.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/40">
                      <td className="py-2 pr-3 font-medium text-slate-300">
                        {item.rows}R · {item.risk}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-400">#{item.slotIndex + 1}</td>
                      <td className="py-2 pr-3 font-mono text-slate-300">{item.bet.toLocaleString()}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-amber-300">
                        {item.multiplier.toFixed(2)}x
                      </td>
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
