import React, { useEffect, useRef } from 'react';

interface CoinCelebrationProps {
  active: boolean;
  onComplete?: () => void;
  durationMs?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  type: 'coin' | 'sparkle';
  alpha: number;
}

export const CoinCelebration: React.FC<CoinCelebrationProps> = ({
  active,
  onComplete,
  durationMs = 2800,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const colors = ['#fde047', '#eab308', '#ca8a04', '#fef08a', '#d4af37'];

    // Spawn 70 gold coins and sparkles
    for (let i = 0; i < 70; i++) {
      const isCoin = Math.random() > 0.35;
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 6,
        size: isCoin ? Math.random() * 8 + 8 : Math.random() * 4 + 3,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: isCoin ? 'coin' : 'sparkle',
        alpha: 1,
      });
    }

    let animationId: number;
    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45; // Gravity
        p.rotation += p.vRot;

        if (elapsed > durationMs - 800) {
          p.alpha = Math.max(0, (durationMs - elapsed) / 800);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.type === 'coin') {
          // Draw 3D gold coin
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * Math.abs(Math.sin(p.rotation)), 0, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else {
          // Sparkle star
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
        }
        ctx.restore();
      });

      if (elapsed < durationMs) {
        animationId = requestAnimationFrame(render);
      } else {
        if (onComplete) onComplete();
      }
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [active, durationMs, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  );
};
