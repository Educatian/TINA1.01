import React, { useEffect, useState } from 'react';
import { TinaAvatar } from './TinaAvatar';
import { buildOnboardingScript, type OnboardingStep } from '../services/onboardingScript';
import type { ActivityConfig } from '../types';

/* ============================================================================
   Onboarding — a first-run, skippable, TINA-narrated scenario tour.

   The TINA character (Higgsfield avatar states) narrates a few stepped cards
   that prime reflection before the cold chat. Calm motion only;
   prefers-reduced-motion is respected via the shared .tina-avatar rules.

   Voice seam: `onStep(step)` fires whenever a step becomes visible, so a
   future ElevenLabs voice toggle can speak `step.body` without touching this
   component's flow. Text ships today; voice attaches later.
   ========================================================================== */

interface OnboardingProps {
    activityConfig: ActivityConfig | null;
    onComplete: () => void;
    onSkip: () => void;
    /** Fires when a step becomes visible — seam for an optional voice layer. */
    onStep?: (step: OnboardingStep) => void;
}

export function Onboarding({ activityConfig, onComplete, onSkip, onStep }: OnboardingProps) {
    const steps = React.useMemo(() => buildOnboardingScript(activityConfig), [activityConfig]);
    const [index, setIndex] = useState(0);
    const step = steps[index];
    const isLast = index === steps.length - 1;

    useEffect(() => {
        if (step) onStep?.(step);
    }, [step, onStep]);

    // Esc skips; ArrowRight/Enter advances; ArrowLeft goes back.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onSkip();
            else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                isLast ? onComplete() : setIndex((i) => Math.min(i + 1, steps.length - 1));
            } else if (e.key === 'ArrowLeft') {
                setIndex((i) => Math.max(i - 1, 0));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isLast, steps.length, onComplete, onSkip]);

    if (!step) return null;

    const advance = () => (isLast ? onComplete() : setIndex((i) => i + 1));

    return (
        <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="TINA introduction">
            <div className="onboarding-card">
                <button className="onboarding-skip" onClick={onSkip} aria-label="Skip introduction">
                    Skip
                </button>

                <div className="onboarding-figure">
                    <TinaAvatar state={step.avatarState} height={170} />
                </div>

                <div className={`onboarding-body ${step.variant === 'scenario' ? 'onboarding-scenario' : ''}`}>
                    {step.title && <h2 className="onboarding-title">{step.title}</h2>}
                    <p className="onboarding-text">{step.body}</p>
                </div>

                <div className="onboarding-dots" aria-hidden="true">
                    {steps.map((s, i) => (
                        <span key={s.id} className={`onboarding-dot ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`} />
                    ))}
                </div>

                <div className="onboarding-actions">
                    {index > 0 && (
                        <button className="btn btn-secondary onboarding-back" onClick={() => setIndex((i) => Math.max(i - 1, 0))}>
                            Back
                        </button>
                    )}
                    <button className="btn btn-primary onboarding-next" onClick={advance}>
                        {step.cta}
                    </button>
                </div>
            </div>
        </div>
    );
}
