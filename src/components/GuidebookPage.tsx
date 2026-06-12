import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    buildUsageGuide,
    GUIDE_ROLES,
    type GuideRole,
} from '../services/usageGuideScript';

/* ============================================================================
   GuidebookPage — the full-page, detailed version of the usage guide.

   The compact modal (UsageGuide) is for a quick skim; this is the shareable
   "read it properly" page: each step gets a large screenshot, the narration,
   an extended how-to paragraph, and a Listen button (TINA's voice). Role tabs
   switch tracks and stay in the URL (?role=learner|instructor) so a learner or
   instructor guide can be linked directly. Public route — no login needed.
   ========================================================================== */

const NARRATION_BASE = '/narration/guide';

function roleFromSearch(search: string): GuideRole {
    const r = new URLSearchParams(search).get('role');
    return r === 'instructor' ? 'instructor' : 'learner';
}

export function GuidebookPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const role = roleFromSearch(location.search);
    const steps = useMemo(() => buildUsageGuide(role), [role]);
    const roleMeta = GUIDE_ROLES.find((r) => r.value === role);

    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Stop any audio when the track changes or the page unmounts.
        return () => { audioRef.current?.pause(); audioRef.current = null; };
    }, [role]);

    useEffect(() => { window.scrollTo({ top: 0 }); }, [role]);

    const setRole = (next: GuideRole) => {
        audioRef.current?.pause();
        setPlayingId(null);
        navigate(`/guide?role=${next}`, { replace: true });
    };

    const toggleClip = (clipId: string) => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        if (playingId === clipId) { setPlayingId(null); return; }
        const audio = new Audio(`${NARRATION_BASE}/${clipId}.mp3`);
        audioRef.current = audio;
        audio.onended = () => setPlayingId((p) => (p === clipId ? null : p));
        audio.play().then(() => setPlayingId(clipId)).catch(() => setPlayingId(null));
    };

    return (
        <div className="guidebook-page">
            <header className="guidebook-topbar">
                <button className="guidebook-back" onClick={() => navigate('/')}>← Back to TINA</button>
                <div className="guidebook-roles" role="tablist" aria-label="Choose a guide">
                    {GUIDE_ROLES.map((r) => (
                        <button
                            key={r.value}
                            role="tab"
                            aria-selected={role === r.value}
                            className={`guidebook-role ${role === r.value ? 'active' : ''}`}
                            onClick={() => setRole(r.value)}
                        >
                            <span aria-hidden="true">{r.icon}</span> {r.label}
                        </button>
                    ))}
                </div>
            </header>

            <div className="guidebook-hero">
                <span className="guidebook-eyebrow">TINA Guidebook</span>
                <h1>{role === 'instructor' ? 'Using TINA with your class' : 'Your 10-minute reflection with TINA'}</h1>
                <p>{roleMeta?.blurb}</p>
            </div>

            <ol className="guidebook-steps">
                {steps.map((step, i) => (
                    <li className={`guidebook-step ${i % 2 === 1 ? 'reversed' : ''}`} key={step.id} id={step.id}>
                        <div className="guidebook-step-figure">
                            <img
                                src={`/guide/${step.frame}`}
                                alt={`${step.title} — TINA screen`}
                                loading="lazy"
                                onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                            />
                        </div>
                        <div className="guidebook-step-body">
                            <div className="guidebook-step-num">
                                <span className="guidebook-step-icon" aria-hidden="true">{step.icon}</span>
                                Step {i + 1} of {steps.length}
                            </div>
                            <h2>{step.title}</h2>
                            <p className="guidebook-step-lead">{step.body}</p>
                            <p className="guidebook-step-detail">{step.detail}</p>
                            <button
                                className={`guidebook-listen ${playingId === step.clipId ? 'playing' : ''}`}
                                onClick={() => toggleClip(step.clipId)}
                            >
                                {playingId === step.clipId ? '❚❚ Pause' : '▶ Listen'} to TINA
                            </button>
                        </div>
                    </li>
                ))}
            </ol>

            <footer className="guidebook-footer">
                <p>That’s the whole guide. {role === 'instructor' ? 'Head to the dashboard to set up your first activity.' : 'Whenever you’re ready, start a reflection.'}</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>
                    {role === 'instructor' ? 'Go to TINA' : 'Start my reflection'}
                </button>
            </footer>
        </div>
    );
}
