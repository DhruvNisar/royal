import { useState, useEffect, useRef, RefObject } from 'react';

export interface MeasuredSize {
  width: number;
  height: number;
}

export type ArcadeLayoutTier = 'mobile' | 'tablet_compact' | 'desktop';

export function getArcadeLayoutTier(containerWidth: number): ArcadeLayoutTier {
  if (containerWidth >= 880) return 'desktop';
  if (containerWidth >= 580) return 'tablet_compact';
  return 'mobile';
}

/**
 * Observes actual container dimensions using ResizeObserver so components
 * adapt directly to available container space rather than viewport width alone.
 */
export function useContainerSize<T extends HTMLElement>(
  initialWidth: number = 360,
  initialHeight: number = 320
): [RefObject<T | null>, MeasuredSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<MeasuredSize>({
    width: initialWidth,
    height: initialHeight,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateSize = (w: number, h: number) => {
      const roundedW = Math.round(w);
      const roundedH = Math.round(h);
      setSize(prev =>
        prev.width === roundedW && prev.height === roundedH
          ? prev
          : { width: roundedW, height: roundedH }
      );
    };

    const rect = el.getBoundingClientRect();
    if (rect.width > 0) {
      updateSize(rect.width, rect.height);
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0) {
            updateSize(width, height);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    const onResize = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) updateSize(r.width, r.height);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return [ref, size];
}

/**
 * Tracks viewport height & devicePixelRatio cleanly for HiDPI canvas scaling
 * and landscape height clamping (e.g. 1024x768, 1366x768).
 */
export function useViewportMetrics(): { vw: number; vh: number; dpr: number } {
  const [metrics, setMetrics] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
    vh: typeof window !== 'undefined' ? window.innerHeight : 800,
    dpr: typeof window !== 'undefined' ? Math.min(3, window.devicePixelRatio || 1) : 1,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMetrics({
          vw: window.innerWidth,
          vh: window.innerHeight,
          dpr: Math.min(3, window.devicePixelRatio || 1),
        });
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return metrics;
}
