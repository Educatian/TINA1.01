import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    buildUsageGuide,
    GUIDE_ROLES,
    type GuideRole,
} from '../services/usageGuideScript';

/* ============================================================================
   UsageGuide — an embedded, role-aware "how to use TINA" walkthrough.

   A narrated screencast: each step pairs a real app frame with a short TINA
   narration. Two tracks (learner / instructor). Text-first + a TINA voice
   toggle that plays the pre-recorded clip for the visible step (same seam as
   the onboarding tour; a blocked autoplay or missing clip simply leaves the
   text). A missing frame degrades to a captioned icon tile, never a broken
   image. Esc closes; arrows / Enter navigate.
   ========================================================================== */

const NARRATION_BASE = '/narration/guide';
const VOICE_PREF_KEY = 'tina-guide-voice';

interface UsageGuideProps {
    /** Which track to open first. */
    initialRole?: GuideRole;
    onClose: () => void;
}

export function UsageGuide({ initialRole = 'learner', onClose }: UsageGuideProps) {
    const navigate = useNavigate();
    const [role, setRole] = useState<GuideRole>(initialRole);

    const openFullPage = () => {
        onClose(); // unmount cleanup pauses any playing narration
        navigate(`/guide?role=${role}`);
    };
    const [index, setIndex] = useState(0);
    const [frameOk, setFrameOk] = useState(true);
    const [voiceOn, setVoiceOn] = useState<boolean>(() => {
        try { return window.localStorage.getItem(VOICE_PREF_KEY) !== 'off'; } catch { return true; }
    });
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const steps = useMemo(() => buildUsageGuide(role), [role]);
    const step = steps[index];
    const isLast = index === steps.length - 1;

    // Reset to the first step + reset the frame-loaded flag when the track changes.
    useEffect(() => { setIndex(0); }, [role]);
    useEffect(() => { setFrameOk(true); }, [step?.frame]);

    // Play the visible step's pre-recorded narration (best-effort, text always wins).
    useEffect(() => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (!step || !voiceOn) return;
        const audio = new Audio(`${NARRATION_BASE}/${step.clipId}.mp3`);
        audioRef.current = audio;
        audio.play().catch(() => { /* autoplay blocked or clip missing — text-only */ });
        return () => { audio.pause(); };
    }, [step, voiceOn]);

    useEffect(() => () => { audioRef.current?.pause(); }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                setIndex((i) => Math.min(i + 1, steps.length - 1));
            } else if (e.key === 'ArrowLeft') {
                setIndex((i) => Math.max(i - 1, 0));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [steps.length, onClose]);

    const toggleVoice = () => {
        setVoiceOn((prev) => {
            const next = !prev;
            try { window.localStorage.setItem(VOICE_PREF_KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
            if (!next && audioRef.current) audioRef.current.pause();
            return next;
        });
    };

    if (!step) return null;

    return (
        <div className="usage-guide-overlay" role="dialog" aria-modal="true" aria-label="How to use TINA">
            <div className="usage-guide-card">
                <div className="usage-guide-topbar">
                    <div className="usage-guide-roles" role="tablist" aria-label="Choose a guide">
                        {GUIDE_ROLES.map((r) => (
                            <button
                                key={r.value}
                                role="tab"
                                aria-selected={role === r.value}
                                className={`usage-guide-role ${role === r.value ? 'active' : ''}`}
                                onClick={() => setRole(r.value)}
                            >
                                <span aria-hidden="true">{r.icon}</span> {r.label}
                            </button>
                        ))}
                    </div>
                    <div className="usage-guide-topbar-actions">
                        <button
                            className="usage-guide-voice"
                            onClick={toggleVoice}
                            aria-pressed={voiceOn}
                            aria-label={voiceOn ? "Turn off TINA's voice" : "Turn on TINA's voice"}
                            title={voiceOn ? 'Voice on' : 'Voice off'}
                        >
                            {voiceOn ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                            )}
                        </button>
                        <button className="usage-guide-close" onClick={onClose} aria-label="Close guide">✕</button>
                    </div>
                </div>

                <div className="usage-guide-stage">
                    {frameOk ? (
                        <img
                            className="usage-guide-frame"
                            src={`/guide/${step.frame}`}
                            alt={`${step.title} — TINA screen`}
                            onError={() => setFrameOk(false)}
                        />
                    ) : (
                        <div className="usage-guide-frame usage-guide-frame-fallback" aria-hidden="true">
                            <span className="usage-guide-frame-icon">{step.icon}</span>
                        </div>
                    )}
                    <span className="usage-guide-step-badge">Step {index + 1} of {steps.length}</span>
                </div>

                <div className="usage-guide-body">
                    <h2 className="usage-guide-title">
                        <span className="usage-guide-title-icon" aria-hidden="true">{step.icon}</span>
                        {step.title}
                    </h2>
                    <p className="usage-guide-text">{step.body}</p>
                </div>

                <button type="button" className="usage-guide-fullpage" onClick={openFullPage}>
                    📖 Read the full guide with bigger screenshots →
                </button>

                <div className="usage-guide-dots" aria-hidden="true">
                    {steps.map((s, i) => (
                        <span key={s.id} className={`usage-guide-dot ${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`} />
                    ))}
                </div>

                <div className="usage-guide-actions">
                    <button
                        className="btn btn-secondary usage-guide-back"
                        onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                        disabled={index === 0}
                    >
                        Back
                    </button>
                    {isLast ? (
                        <button className="btn btn-primary usage-guide-next" onClick={onClose}>Done</button>
                    ) : (
                        <button className="btn btn-primary usage-guide-next" onClick={() => setIndex((i) => i + 1)}>Next</button>
                    )}
                </div>
            </div>
        </div>
    );
}
