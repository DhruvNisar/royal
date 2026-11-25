import React, { useEffect, useState } from 'react';
import {
  calculateDealCoins,
  formatDealMultiplier,
  isHighTierMultiplier,
} from './dealMath';
import { soundManager } from '../../services/sound';
import { LockOpen, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';

interface CaseRevealModalProps {
  caseNumber: number;
  multiplier: number;
  bet: number;
  isFinalReveal?: boolean;
  finalLabel?: string;
  onComplete: () => void;
}

type RevealStep = 'unlocking' | 'opening' | 'revealed';

/**
 * Dramatic center-stage 3D briefcase opening animation:
 * 1) Latches click & unlock
 * 2) Metallic lid swings open with perspective rotation
 * 3) Prize multiplier + coin value emerge with tailored audio/visual feedback
 */
export const CaseRevealModal: React.FC<CaseRevealModalProps> = ({
  caseNumber,
  multiplier,
  bet,
  isFinalReveal = false,
  finalLabel,
  onComplete,
}) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [step, setStep] = useState<RevealStep>(prefersReducedMotion ? 'revealed' : 'unlocking');
  const coinsValue = calculateDealCoins(bet, multiplier);
  const isHighTier = isHighTierMultiplier(multiplier);

  useEffect(() => {
    if (prefersReducedMotion) {
      soundManager.playBriefcaseReveal(isFinalReveal ? !isHighTier : isHighTier);
      const autoDone = window.setTimeout(onComplete, isFinalReveal ? 1600 : 1200);
      return () => window.clearTimeout(autoDone);
    }

    soundManager.playBriefcaseLatch();

    const tOpen = window.setTimeout(() => {
      setStep('opening');
    }, 340);

    const tReveal = window.setTimeout(() => {
      setStep('revealed');
      if (isFinalReveal) {
        if (multiplier >= 1) soundManager.playWin();
        else soundManager.playLoss();
      } else {
        soundManager.playBriefcaseReveal(isHighTier);
      }
    }, 900);

    const tAutoFinish = window.setTimeout(() => {
      onComplete();
    }, isFinalReveal ? 2900 : 2250);

    return () => {
      window.clearTimeout(tOpen);
      window.clearTimeout(tReveal);
      window.clearTimeout(tAutoFinish);
    };
  }, [caseNumber, multiplier, isHighTier, isFinalReveal, prefersReducedMotion, onComplete]);

  // For regular case elimination: eliminating low values is GOOD (emerald), big prizes is PAINFUL (crimson).
  // For final reveal (winning your case): high value is GREAT (amber/emerald), low value is muted/slate.
  const isPositiveOutcome = isFinalReveal ? multiplier >= 1 : !isHighTier;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Opening briefcase ${caseNumber}`}
    >
      <div className="w-full max-w-sm rounded-3xl border border-amber-500/45 bg-gradient-to-b from-[#13192c] via-[#0c1120] to-[#080b14] p-5 text-center shadow-[0_0_60px_rgba(0,0,0,0.85)] sm:p-6">
        <div className="text-xs font-bold tracking-widest text-amber-300/90 uppercase">
          {finalLabel ?? `Opening Briefcase #${caseNumber}`}
        </div>

        {/* 3D Animated Briefcase Stage */}
        <div className="relative mx-auto mt-5 mb-5 flex h-44 w-full max-w-[260px] items-center justify-center">
          {/* Ambient radial glow once opened */}
          {step === 'revealed' && (
            <div
              className={`pointer-events-none absolute inset-0 rounded-full blur-2xl ${
                isPositiveOutcome ? 'bg-emerald-500/25' : 'bg-rose-500/25'
              }`}
            />
          )}

          {/* Briefcase Base Box */}
          <div className="relative h-32 w-56 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-b from-[#1b1408] via-[#110d06] to-[#0a0805] shadow-2xl">
            {/* Velvet Interior & Revealed Prize Card */}
            <div className="absolute inset-2 flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-b from-[#0b1326] to-[#060913] px-2">
              {step === 'revealed' ? (
                <div className="animate-dnd-prize-rise flex flex-col items-center">
                  <div
                    className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                      isFinalReveal
                        ? multiplier >= 10
                          ? 'text-amber-300'
                          : multiplier >= 1
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                        : isHighTier
                        ? 'text-rose-400'
                        : 'text-emerald-300'
                    }`}
                  >
                    {formatDealMultiplier(multiplier)}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-slate-200 tabular-nums">
                    {coinsValue.toLocaleString()} coins
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-amber-300/80">
                  <LockOpen className="h-6 w-6 animate-pulse" />
                  <span className="text-[11px] font-bold tracking-wider uppercase">
                    {step === 'unlocking' ? 'Unlocking...' : 'Opening...'}
                  </span>
                </div>
              )}
            </div>

            {/* Hinged Metallic Gold Lid */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-lg ${
                step === 'opening' || step === 'revealed' ? 'animate-dnd-lid-open' : ''
              } ${step === 'revealed' && prefersReducedMotion ? 'opacity-0 pointer-events-none' : ''}`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Handle */}
              <div className="absolute -top-3.5 h-3.5 w-14 rounded-t-lg border-4 border-b-0 border-amber-300 bg-slate-950/60" />
              {/* Twin clasps */}
              <div className="absolute top-2.5 left-5 h-2.5 w-4 rounded-sm bg-slate-950/80 ring-1 ring-amber-200" />
              <div className="absolute top-2.5 right-5 h-2.5 w-4 rounded-sm bg-slate-950/80 ring-1 ring-amber-200" />
              {/* Number medallion */}
              <div className="flex h-14 w-20 items-center justify-center rounded-xl border-2 border-amber-100/80 bg-slate-950/90 text-3xl font-black tabular-nums text-amber-300 shadow-inner">
                {caseNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="min-h-[42px]">
          {step === 'revealed' ? (
            <div
              className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold ${
                isPositiveOutcome ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {isPositiveOutcome ? (
                <Sparkles className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>
                {isFinalReveal
                  ? `Case #${caseNumber} holds ${formatDealMultiplier(multiplier)} (${coinsValue.toLocaleString()} coins)!`
                  : isHighTier
                  ? `Big prize eliminated from the board!`
                  : `Low prize cleared — great for your odds!`}
              </span>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Breaking the seal on briefcase #{caseNumber}...
            </p>
          )}
        </div>

        {/* Skip / Continue button once revealed */}
        {step === 'revealed' && (
          <button
            type="button"
            onClick={onComplete}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-5 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-400/25"
          >
            <span>Continue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
