import React, { useEffect, useRef } from 'react';
import { CoinPusherDropPlan, PusherTokenKind } from './coinPusherLogic';
import { COIN_PUSHER_LANE_COUNT } from './coinPusherMath';
import { soundManager } from '../../services/sound';
import { ChevronDown } from 'lucide-react';

interface CoinPusherCabinetProps {
  selectedLane: number; // 1..5
  onSelectLane: (lane: number) => void;
  activePlan: CoinPusherDropPlan | null;
  lastSettledPlan: CoinPusherDropPlan | null;
  isDropping: boolean;
  onDropAnimationComplete: (roundId: string) => void;
}

interface ShelfCoin {
  xNorm: number; // 0.12 .. 0.88
  rowNorm: number; // 0 = back near pusher, 1 = front lip
  kind: PusherTokenKind;
  radius: number;
  phaseOffset: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Deterministic decorative coin deck populated across the perspective shelf
function createDeckCoins(): ShelfCoin[] {
  const coins: ShelfCoin[] = [];
  const rows = [
    { rowNorm: 0.16, count: 7 },
    { rowNorm: 0.34, count: 8 },
    { rowNorm: 0.54, count: 9 },
    { rowNorm: 0.74, count: 9 },
    { rowNorm: 0.91, count: 8 },
  ];

  let idx = 0;
  for (const r of rows) {
    for (let c = 0; c < r.count; c++) {
      const spread = (c + 0.5) / r.count;
      const jitterX = (((idx * 37) % 13) - 6) * 0.008;
      const jitterY = (((idx * 23) % 9) - 4) * 0.009;
      let kind: PusherTokenKind = 'gold_coin';
      if (idx === 14 || idx === 28) kind = 'emerald_token';
      else if (idx === 21 || idx === 36) kind = 'ruby_medallion';
      else if (idx === 9) kind = 'sapphire_token';

      coins.push({
        xNorm: Math.max(0.11, Math.min(0.89, 0.12 + spread * 0.76 + jitterX)),
        rowNorm: Math.max(0.1, Math.min(0.95, r.rowNorm + jitterY)),
        kind,
        radius: kind === 'ruby_medallion' ? 13.5 : kind === 'emerald_token' ? 12.5 : 11,
        phaseOffset: (idx * 0.47) % (Math.PI * 2),
      });
      idx += 1;
    }
  }
  return coins;
}

function drawMetallicToken(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  thickness: number,
  kind: PusherTokenKind,
  highlightAlpha: number = 1
) {
  ctx.save();
  ctx.globalAlpha = highlightAlpha;

  let rimColor = '#92610c';
  let topStart = '#fef08a';
  let topMid = '#eab308';
  let topEnd = '#b45309';
  let innerRing = '#fffbeb';

  if (kind === 'emerald_token') {
    rimColor = '#065f46';
    topStart = '#6ee7b7';
    topMid = '#10b981';
    topEnd = '#047857';
    innerRing = '#d1fae5';
  } else if (kind === 'ruby_medallion') {
    rimColor = '#881337';
    topStart = '#fda4af';
    topMid = '#f43f5e';
    topEnd = '#9f1239';
    innerRing = '#ffe4e6';
  } else if (kind === 'sapphire_token') {
    rimColor = '#1e3a8a';
    topStart = '#93c5fd';
    topMid = '#3b82f6';
    topEnd = '#1d4ed8';
    innerRing = '#dbeafe';
  }

  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y + thickness + 2, rx * 1.02, ry * 0.96, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3D cylindrical rim
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.ellipse(x, y + thickness, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - rx, y, rx * 2, thickness);

  // Top metallic face
  const grad = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  grad.addColorStop(0, topStart);
  grad.addColorStop(0.55, topMid);
  grad.addColorStop(1, topEnd);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner engraved ring
  ctx.strokeStyle = innerRing;
  ctx.globalAlpha = 0.55 * highlightAlpha;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Specular glint
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.42 * highlightAlpha;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.28, y - ry * 0.24, rx * 0.24, ry * 0.16, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const LOGICAL_W = 520;
const LOGICAL_H = 468;

export const CoinPusherCabinet: React.FC<CoinPusherCabinetProps> = ({
  selectedLane,
  onSelectLane,
  activePlan,
  lastSettledPlan,
  isDropping,
  onDropAnimationComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const deckCoinsRef = useRef<ShelfCoin[]>(createDeckCoins());
  const activePlanRef = useRef<CoinPusherDropPlan | null>(activePlan);
  const selectedLaneRef = useRef<number>(selectedLane);
  const onCompleteRef = useRef<(roundId: string) => void>(onDropAnimationComplete);
  const animStartMsRef = useRef<number | null>(null);
  const completedRoundIdRef = useRef<string | null>(null);
  const playedClinkIndicesRef = useRef<Set<number>>(new Set());
  const sparksRef = useRef<SparkParticle[]>([]);

  useEffect(() => {
    selectedLaneRef.current = selectedLane;
  }, [selectedLane]);

  useEffect(() => {
    onCompleteRef.current = onDropAnimationComplete;
  }, [onDropAnimationComplete]);

  useEffect(() => {
    activePlanRef.current = activePlan;
    if (activePlan) {
      animStartMsRef.current = performance.now();
      completedRoundIdRef.current = null;
      playedClinkIndicesRef.current = new Set();
      sparksRef.current = [];
    } else {
      animStartMsRef.current = null;
    }
  }, [activePlan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let isCancelled = false;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const totalAnimDurationMs = reducedMotion ? 650 : 2150;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    const renderFrame = (nowMs: number) => {
      if (isCancelled) return;

      const dprScaleX = canvas.width / LOGICAL_W;
      const dprScaleY = canvas.height / LOGICAL_H;

      ctx.save();
      ctx.scale(dprScaleX, dprScaleY);

      // Background dark mahogany cabinet interior
      const bgGrad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
      bgGrad.addColorStop(0, '#171019');
      bgGrad.addColorStop(0.35, '#121520');
      bgGrad.addColorStop(1, '#090b10');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Overhead warm casino spotlight cone
      const spotGrad = ctx.createRadialGradient(LOGICAL_W / 2, 30, 12, LOGICAL_W / 2, 160, 260);
      spotGrad.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
      spotGrad.addColorStop(0.55, 'rgba(217, 119, 6, 0.08)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, LOGICAL_W, 330);

      // Determine animation progress
      const plan = activePlanRef.current;
      const elapsed = plan && animStartMsRef.current !== null ? nowMs - animStartMsRef.current : 0;
      const progress = plan ? Math.min(1, elapsed / totalAnimDurationMs) : 0;

      // Continuous sinusoidal pusher movement (synchronized surge during active drop)
      let pusherExtend = 0.5 + 0.5 * Math.sin(nowMs * 0.0024);
      if (reducedMotion && !plan) {
        pusherExtend = 0.35;
      }
      if (plan) {
        // Phase 1 (0..0.22): Coin drops down lane while pusher retracts
        // Phase 2 (0.22..0.60): Pusher surges smoothly forward to maximum extension
        // Phase 3 (0.60..1.00): Pusher retracts slightly while prize tokens fall into tray
        if (progress < 0.22) {
          pusherExtend = 0.25 * (1 - progress / 0.22);
        } else if (progress < 0.6) {
          const p = (progress - 0.22) / 0.38;
          pusherExtend = 0.1 + 0.9 * (1 - Math.pow(1 - p, 2));
        } else {
          const p = (progress - 0.6) / 0.4;
          pusherExtend = 1.0 - 0.55 * p;
        }
      }

      // 1. BACKBOARD & DROP CHUTE LANES (y: 12..148)
      ctx.fillStyle = '#1b141a';
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(26, 12, LOGICAL_W - 52, 134, 12);
      ctx.fill();
      ctx.stroke();

      // Draw 5 drop lane channels & brass deflectors
      const laneAreaLeft = 46;
      const laneAreaW = LOGICAL_W - 92;
      const laneStep = laneAreaW / COIN_PUSHER_LANE_COUNT;

      for (let i = 0; i < COIN_PUSHER_LANE_COUNT; i++) {
        const cx = laneAreaLeft + laneStep * (i + 0.5);
        const isLaneSelected = selectedLaneRef.current === i + 1;

        if (isLaneSelected) {
          const laneGlow = ctx.createLinearGradient(cx, 14, cx, 144);
          laneGlow.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
          laneGlow.addColorStop(1, 'rgba(250, 204, 21, 0.02)');
          ctx.fillStyle = laneGlow;
          ctx.fillRect(cx - laneStep * 0.42, 14, laneStep * 0.84, 130);
        }

        // Brass guide rails between lanes
        if (i > 0) {
          const railX = laneAreaLeft + laneStep * i;
          ctx.strokeStyle = 'rgba(212, 175, 55, 0.22)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(railX, 20);
          ctx.lineTo(railX, 136);
          ctx.stroke();
        }

        // Brass deflector pins
        const pinYs = [54, 96];
        for (const py of pinYs) {
          ctx.fillStyle = '#d4af37';
          ctx.beginPath();
          ctx.arc(cx, py, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef9c3';
          ctx.beginPath();
          ctx.arc(cx - 1.2, py - 1.2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. PERSPECTIVE PLAYFIELD DECK (Trapezoid: top y=148, front lip y=318)
      const deckTopY = 148;
      const deckFrontY = 318;
      const topLeftX = 48;
      const topRightX = LOGICAL_W - 48;
      const botLeftX = 20;
      const botRightX = LOGICAL_W - 20;

      // Side perspective walls (brushed dark bronze)
      ctx.fillStyle = '#120f14';
      ctx.beginPath();
      ctx.moveTo(26, 146);
      ctx.lineTo(topLeftX, deckTopY);
      ctx.lineTo(botLeftX, deckFrontY);
      ctx.lineTo(12, deckFrontY + 14);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(LOGICAL_W - 26, 146);
      ctx.lineTo(topRightX, deckTopY);
      ctx.lineTo(botRightX, deckFrontY);
      ctx.lineTo(LOGICAL_W - 12, deckFrontY + 14);
      ctx.closePath();
      ctx.fill();

      // Main metallic deck floor
      const deckGrad = ctx.createLinearGradient(0, deckTopY, 0, deckFrontY);
      deckGrad.addColorStop(0, '#1e2430');
      deckGrad.addColorStop(0.55, '#262d3d');
      deckGrad.addColorStop(1, '#1a202c');
      ctx.fillStyle = deckGrad;
      ctx.beginPath();
      ctx.moveTo(topLeftX, deckTopY);
      ctx.lineTo(topRightX, deckTopY);
      ctx.lineTo(botRightX, deckFrontY);
      ctx.lineTo(botLeftX, deckFrontY);
      ctx.closePath();
      ctx.fill();

      // Subtle deck perspective grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let g = 1; g < 5; g++) {
        const t = g / 5;
        ctx.beginPath();
        ctx.moveTo(topLeftX + (topRightX - topLeftX) * t, deckTopY);
        ctx.lineTo(botLeftX + (botRightX - botLeftX) * t, deckFrontY);
        ctx.stroke();
      }

      // 3. MOVING PUSHER PLATE (Reciprocating Upper Step)
      const pusherFrontY = deckTopY + 18 + pusherExtend * 42;
      const pusherLerp = (pusherFrontY - deckTopY) / (deckFrontY - deckTopY);
      const pLeft = topLeftX + (botLeftX - topLeftX) * pusherLerp;
      const pRight = topRightX + (botRightX - topRightX) * pusherLerp;

      // Pusher top brushed-brass surface
      const pushTopGrad = ctx.createLinearGradient(0, deckTopY - 8, 0, pusherFrontY);
      pushTopGrad.addColorStop(0, '#5a4319');
      pushTopGrad.addColorStop(0.5, '#b58927');
      pushTopGrad.addColorStop(1, '#f3d06b');
      ctx.fillStyle = pushTopGrad;
      ctx.beginPath();
      ctx.moveTo(topLeftX + 2, deckTopY - 8);
      ctx.lineTo(topRightX - 2, deckTopY - 8);
      ctx.lineTo(pRight - 2, pusherFrontY);
      ctx.lineTo(pLeft + 2, pusherFrontY);
      ctx.closePath();
      ctx.fill();

      // Pusher front vertical metallic bumper face (gives real 3D height)
      const bumperH = 16;
      const bumperGrad = ctx.createLinearGradient(0, pusherFrontY, 0, pusherFrontY + bumperH);
      bumperGrad.addColorStop(0, '#fde68a');
      bumperGrad.addColorStop(0.35, '#ca8a04');
      bumperGrad.addColorStop(1, '#713f12');
      ctx.fillStyle = bumperGrad;
      ctx.fillRect(pLeft + 2, pusherFrontY, pRight - pLeft - 4, bumperH);

      // Pusher rivets
      ctx.fillStyle = '#451a03';
      for (let r = 0; r < 7; r++) {
        const rx = pLeft + 20 + ((pRight - pLeft - 40) * r) / 6;
        ctx.beginPath();
        ctx.arc(rx, pusherFrontY + bumperH * 0.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. DECK COINS & PRIZE TOKENS (Sorted back-to-front for natural overlap)
      // When pusher surges, coins shift smoothly toward the edge (without crossing on NO_PRIZE)
      const surgePush =
        plan && progress >= 0.22
          ? Math.sin(Math.min(1, (progress - 0.22) / 0.55) * Math.PI) *
            (plan.outcome === 'NO_PRIZE' ? 0.032 : 0.06)
          : (pusherExtend - 0.5) * 0.02;

      for (const coin of deckCoinsRef.current) {
        const dynamicRow = Math.min(0.97, Math.max(0.14, coin.rowNorm + surgePush));
        const y = deckTopY + 58 + dynamicRow * (deckFrontY - (deckTopY + 58) - 8);
        const rowT = (y - deckTopY) / (deckFrontY - deckTopY);
        const rowLeft = topLeftX + (botLeftX - topLeftX) * rowT;
        const rowRight = topRightX + (botRightX - topRightX) * rowT;
        const x = rowLeft + (rowRight - rowLeft) * coin.xNorm;

        // Perspective foreshortening
        const scale = 0.8 + rowT * 0.34;
        const rx = coin.radius * scale;
        const ry = rx * 0.52;

        drawMetallicToken(ctx, x, y, rx, ry, 3.6 * scale, coin.kind);
      }

      // 5. DROPPED PLAYER COIN ANIMATION (Phase 1: 0..0.28)
      if (plan && progress < 0.34) {
        const laneCenterX = laneAreaLeft + laneStep * (plan.lane - 0.5);
        const dropT = Math.min(1, progress / 0.22);
        const easedFall = dropT * dropT;
        const bounceOffset =
          progress > 0.22
            ? Math.abs(Math.sin(((progress - 0.22) / 0.12) * Math.PI)) * 18
            : 0;
        const wobbleX = Math.sin(dropT * Math.PI * 2) * 5;
        const coinY = 20 + easedFall * (pusherFrontY - 26) - bounceOffset;
        const coinAlpha = progress > 0.28 ? Math.max(0, 1 - (progress - 0.28) / 0.06) : 1;

        drawMetallicToken(ctx, laneCenterX + wobbleX, coinY, 13, 10.5 - dropT * 3.5, 3.5, 'gold_coin', coinAlpha);
      }

      // 6. FRONT DROP EDGE (Beveled Brass Lip)
      const lipGrad = ctx.createLinearGradient(0, deckFrontY, 0, deckFrontY + 14);
      lipGrad.addColorStop(0, '#facc15');
      lipGrad.addColorStop(0.5, '#b45309');
      lipGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = lipGrad;
      ctx.fillRect(botLeftX, deckFrontY, botRightX - botLeftX, 13);

      // 7. COLLECTION TRAY & CHUTE (y: 331..454)
      const trayTopY = 331;
      const trayBottomY = 452;

      // Recessed dark chute behind tray
      ctx.fillStyle = '#07080d';
      ctx.fillRect(22, trayTopY, LOGICAL_W - 44, trayBottomY - trayTopY);

      // Warm golden glow inside tray when prizes drop
      const isTrayCelebrating =
        (plan && plan.trayTokens.length > 0 && progress >= 0.45) ||
        (!plan && lastSettledPlan && lastSettledPlan.grossPayout > 0);
      if (isTrayCelebrating) {
        const glowStrength = plan?.outcome === 'BIG_PRIZE' ? 0.38 : 0.22;
        const trayGlow = ctx.createRadialGradient(
          LOGICAL_W / 2,
          trayBottomY - 24,
          10,
          LOGICAL_W / 2,
          trayBottomY - 20,
          210
        );
        trayGlow.addColorStop(0, `rgba(250, 204, 21, ${glowStrength})`);
        trayGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = trayGlow;
        ctx.fillRect(22, trayTopY, LOGICAL_W - 44, trayBottomY - trayTopY);
      }

      // Brass tray floor & front cradle
      const cradleGrad = ctx.createLinearGradient(0, trayBottomY - 34, 0, trayBottomY);
      cradleGrad.addColorStop(0, '#1e222e');
      cradleGrad.addColorStop(1, '#0f121a');
      ctx.fillStyle = cradleGrad;
      ctx.beginPath();
      ctx.roundRect(28, trayBottomY - 38, LOGICAL_W - 56, 36, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 8. FALLING & BOUNCING PRIZE TOKENS (Strictly driven by predetermined plan.trayTokens!)
      const activeOrSettledTokens = plan
        ? plan.trayTokens
        : lastSettledPlan
          ? lastSettledPlan.trayTokens
          : [];

      if (plan && plan.trayTokens.length > 0 && progress >= 0.42) {
        const fallElapsedMs = (progress - 0.42) * totalAnimDurationMs;

        plan.trayTokens.forEach((tok, idx) => {
          const localMs = fallElapsedMs - tok.releaseDelayMs;
          if (localMs < 0) return;

          const fallDurationMs = reducedMotion ? 160 : 480;
          const t = Math.min(1, localMs / fallDurationMs);

          // Trigger metallic tray clink right when token lands in tray
          if (t >= 0.72 && !playedClinkIndicesRef.current.has(idx)) {
            playedClinkIndicesRef.current.add(idx);
            soundManager.playCoinPusherTrayClink(idx % 5);

            // Spawn sparkle burst for BIG_PRIZE or ruby/emerald tokens
            if (plan.outcome === 'BIG_PRIZE' || tok.kind !== 'gold_coin') {
              const landX = botLeftX + (botRightX - botLeftX) * tok.edgeXNorm;
              const landY = trayBottomY - 22;
              const sparkCount = plan.outcome === 'BIG_PRIZE' ? 6 : 3;
              for (let s = 0; s < sparkCount; s++) {
                const angle = -Math.PI * 0.15 - (Math.PI * 0.7 * (s + 0.5)) / sparkCount;
                const speed = 1.6 + (s % 3) * 1.1;
                sparksRef.current.push({
                  x: landX,
                  y: landY,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  life: 0,
                  maxLife: 24,
                  color:
                    tok.kind === 'ruby_medallion'
                      ? '#fb7185'
                      : tok.kind === 'emerald_token'
                        ? '#34d399'
                        : '#fde047',
                  size: 2.5,
                });
              }
            }
          }

          const startX = botLeftX + (botRightX - botLeftX) * tok.edgeXNorm;
          const x = startX + tok.vx * 36 * t;
          const restY = trayBottomY - 19 - (idx % 3) * 4.5;

          let y = deckFrontY + 6;
          if (t < 0.72) {
            const ft = t / 0.72;
            y = deckFrontY + 6 + (restY - (deckFrontY + 6)) * (ft * ft);
          } else {
            const bt = (t - 0.72) / 0.28;
            const bounce = Math.sin(bt * Math.PI) * tok.bounceHeight * (1 - bt * 0.4);
            y = restY - bounce;
          }

          drawMetallicToken(ctx, x, y, tok.radius, tok.radius * 0.56, 3.6, tok.kind);
        });
      } else if (!plan && activeOrSettledTokens.length > 0) {
        // Keep last settled prize coins resting visibly in the collection tray until next drop!
        activeOrSettledTokens.forEach((tok, idx) => {
          const x = botLeftX + (botRightX - botLeftX) * tok.edgeXNorm + tok.vx * 36;
          const restY = trayBottomY - 19 - (idx % 3) * 4.5;
          drawMetallicToken(ctx, x, restY, tok.radius, tok.radius * 0.56, 3.6, tok.kind);
        });
      }

      // Render sparkle particles
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const sp = sparksRef.current[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.14;
        sp.life += 1;
        if (sp.life >= sp.maxLife) {
          sparksRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = 1 - sp.life / sp.maxLife;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Outer brushed-brass cabinet glass bezel highlight
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, LOGICAL_W - 8, LOGICAL_H - 8);

      // Subtle diagonal glass reflection
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.beginPath();
      ctx.moveTo(24, 14);
      ctx.lineTo(130, 14);
      ctx.lineTo(54, 316);
      ctx.lineTo(24, 316);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // Fire completion callback exactly once when drop animation finishes
      if (plan && progress >= 1 && completedRoundIdRef.current !== plan.roundId) {
        completedRoundIdRef.current = plan.roundId;
        onCompleteRef.current(plan.roundId);
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [lastSettledPlan]);

  return (
    <div className="w-full max-w-full rounded-2xl bg-gradient-to-b from-[#1f1712] via-[#141219] to-[#0c0d13] border border-amber-500/35 shadow-2xl p-2 sm:p-3.5 space-y-2">
      {/* Arcade Cabinet Header & Interactive 5-Lane Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] sm:text-xs font-serif font-bold text-amber-300 uppercase tracking-wider">
            Select Drop Lane
          </span>
          <span className="text-[10px] sm:text-xs text-slate-400">
            Active: <strong className="text-amber-300">Lane {selectedLane}</strong>
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {Array.from({ length: COIN_PUSHER_LANE_COUNT }, (_, idx) => {
            const laneNum = idx + 1;
            const isSelected = selectedLane === laneNum;
            return (
              <button
                key={laneNum}
                type="button"
                disabled={isDropping}
                onClick={() => {
                  soundManager.playButtonClick();
                  onSelectLane(laneNum);
                }}
                aria-label={`Select Drop Lane ${laneNum}`}
                className={`py-1.5 sm:py-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all min-h-[42px] disabled:opacity-60 ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-slate-950 border-amber-200 shadow-md shadow-amber-500/30'
                    : 'bg-[#171a24] hover:bg-[#212534] text-slate-300 border-slate-800'
                }`}
              >
                <span className="leading-none text-[11px] sm:text-xs font-mono">L{laneNum}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 mt-0.5 ${isSelected ? 'text-slate-950' : 'text-amber-400/60'}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Responsive Aspect-Locked 2.5D Pusher Canvas */}
      <div className="relative w-full overflow-hidden rounded-xl border border-amber-500/25 bg-[#090b10] aspect-[520/468] max-h-[540px] mx-auto">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          aria-label="Royal Coin Pusher animated arcade machine"
        />

        {/* Tray Status Readout Overlay inside bottom bezel */}
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-sm border border-amber-500/25 text-[10px] sm:text-xs min-w-0">
          <span className="text-slate-300 font-semibold uppercase tracking-wide shrink-0">
            Tray
          </span>
          {isDropping ? (
            <span className="font-mono font-bold text-amber-300 truncate">Pusher Active…</span>
          ) : lastSettledPlan ? (
            <span
              className={`font-mono font-bold tabular-nums animate-pusher-tray truncate ${
                lastSettledPlan.grossPayout > 0 ? 'text-emerald-300' : 'text-slate-400'
              }`}
            >
              {lastSettledPlan.outcomeLabel} ({lastSettledPlan.multiplier.toFixed(2)}×) ·{' '}
              {lastSettledPlan.grossPayout.toLocaleString()} coins
            </span>
          ) : (
            <span className="font-mono text-slate-400 truncate">Drop a coin to begin</span>
          )}
        </div>
      </div>
    </div>
  );
};
