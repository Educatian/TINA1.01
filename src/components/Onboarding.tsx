import React, { useEffect, useRef, useState } from 'react';
import { TinaAvatar } from './TinaAvatar';
import { buildOnboardingScript, type OnboardingStep } from '../services/onboardingScript';
import type { ActivityConfig } from '../types';

const VOICE_PREF_KEY = 'tina-onboarding-voice';
const NARRATION_BASE = '/narration/onboarding';

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
    const [voiceOn, setVoiceOn] = useState<boolean>(() => {
        try {
            // Default ON, but remembered. Autoplay still requires the user's
            // first click (advancing past "Show me"), which browsers count as a
            // gesture, so audio is never forced before interaction.
            return window.localStorage.getItem(VOICE_PREF_KEY) !== 'off';
        } catch {
            return true;
        }
    });
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const step = steps[index];
    const isLast = index === steps.length - 1;

    // Play the current step's pre-recorded narration clip (if any + voice on).
    // Best-effort: a blocked autoplay or missing file just leaves the text.
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (!step) return;
        onStep?.(step);
        if (!voiceOn || !step.clipId) return;
        const audio = new Audio(`${NARRATION_BASE}/${step.clipId}.mp3`);
        audioRef.current = audio;
        audio.play().catch(() => { /* autoplay blocked or file missing — text-only */ });
        return () => { audio.pause(); };
    }, [step, voiceOn, onStep]);

    useEffect(() => () => { audioRef.current?.pause(); }, []);

    const toggleVoice = () => {
        setVoiceOn((prev) => {
            const next = !prev;
            try { window.localStorage.setItem(VOICE_PREF_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
            if (!next && audioRef.current) audioRef.current.pause();
            return next;
        });
    };

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
                <div className="onboarding-topbar">
                    <button
                        className="onboarding-voice"
                        onClick={toggleVoice}
                        aria-pressed={voiceOn}
                        aria-label={voiceOn ? 'Turn off TINA\'s voice' : 'Turn on TINA\'s voice'}
                        title={voiceOn ? 'Voice on' : 'Voice off'}
                    >
                        {voiceOn ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                            </svg>
                        )}
                    </button>
                    <button className="onboarding-skip" onClick={onSkip} aria-label="Skip introduction">
                        Skip
                    </button>
                </div>

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
