import React, { useEffect, useState } from 'react';
import {
    getCoachingTurnsForSession,
    depthScore,
    depthBand,
    extractNextMove,
    type DepthBand,
} from '../services/reflectionLoop';
import { CollapsibleSection } from './CollapsibleSection';
import type { Session } from '../types';

/* ============================================================================
   ReflectionJourney — the learner's growth ACROSS sessions (not within one).

   Closes the cross-session loop on the learner's side: a small depth sparkline
   over time, each session's "One Next Move", and (where recorded) how their
   self-rated depth tracked the depth their turns actually showed (JOL
   calibration trend). Everything degrades gracefully if the coaching-move
   telemetry / JOL columns are not present.
   ========================================================================== */

interface JourneyPoint {
    id: string;
    date: string;
    band: DepthBand;
    hasDepth: boolean;
    nextMove: string | null;
    jolRating: number | null;
    jolMeasured: number | null;
}

const BAND_CLASS: Record<DepthBand, string> = { 1: 'technical', 2: 'descriptive', 3: 'critical' };
const MAX_SESSIONS = 12;

export function ReflectionJourney({ sessions }: { sessions: Session[] }) {
    const completed = sessions
        .filter((s) => s.completed_at)
        .slice(0, MAX_SESSIONS)
        .slice()
        .reverse(); // oldest -> newest for a left-to-right timeline

    const [points, setPoints] = useState<JourneyPoint[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const out: JourneyPoint[] = [];
            for (const s of completed) {
                const turns = await getCoachingTurnsForSession(s.id);
                const score = depthScore(turns);
                out.push({
                    id: s.id,
                    date: new Date(s.completed_at || s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    band: depthBand(score),
                    hasDepth: turns.length > 0,
                    nextMove: extractNextMove(s.summary_report),
                    jolRating: typeof (s as any).jol_rating === 'number' ? (s as any).jol_rating : null,
                    jolMeasured: typeof (s as any).jol_measured_band === 'number' ? (s as any).jol_measured_band : null,
                });
            }
            if (!cancelled) setPoints(out);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessions]);

    if (completed.length === 0) return null;

    const withDepth = (points || []).filter((p) => p.hasDepth);
    const withJol = (points || []).filter((p) => p.jolRating !== null && p.jolMeasured !== null);

    return (
        <CollapsibleSection
            storageKey="journey"
            title="Your Reflection Journey"
            summary={`${completed.length} completed ${completed.length === 1 ? 'session' : 'sessions'}`}
            defaultOpen={false}
        >
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                How your reflection has grown across {completed.length} completed
                {completed.length === 1 ? ' session' : ' sessions'}.
            </p>

            {points === null ? (
                <p style={{ color: '#9ca3af' }}>Building your journey…</p>
            ) : (
                <>
                    {withDepth.length > 0 && (
                        <div className="journey-block">
                            <h3 className="journey-h3">Reflection depth over time</h3>
                            <div className="journey-bars">
                                {points.map((p) => (
                                    <div key={p.id} className="journey-col" title={`${p.date}: ${['', 'brief', 'describing', 'examining why'][p.band]}`}>
                                        <div className="journey-bar-track">
                                            {p.hasDepth ? (
                                                <div className={`journey-bar trajectory-${BAND_CLASS[p.band]}`} style={{ height: `${p.band * 26}px` }} />
                                            ) : (
                                                <div className="journey-bar journey-bar-empty" style={{ height: '6px' }} />
                                            )}
                                        </div>
                                        <span className="journey-date">{p.date}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="trajectory-legend">
                                <span><i className="trajectory-dot trajectory-technical" /> Brief</span>
                                <span><i className="trajectory-dot trajectory-descriptive" /> Describing</span>
                                <span><i className="trajectory-dot trajectory-critical" /> Examining why</span>
                            </div>
                        </div>
                    )}

                    {withJol.length > 0 && (
                        <div className="journey-block">
                            <h3 className="journey-h3">How your sense of depth tracked reality</h3>
                            <p className="report-trajectory-note">
                                Each session: what you felt (●) next to what your turns showed (○). When they sit
                                close, your read on your own reflection is well calibrated.
                            </p>
                            <div className="journey-jol">
                                {withJol.map((p) => (
                                    <div key={p.id} className="journey-jol-col" title={p.date}>
                                        <div className="journey-jol-track">
                                            <span className="jol-dot jol-self" style={{ bottom: `${(p.jolRating! - 1) * 28}px` }} />
                                            <span className="jol-dot jol-measured" style={{ bottom: `${(p.jolMeasured! - 1) * 28}px` }} />
                                        </div>
                                        <span className="journey-date">{p.date}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="trajectory-legend">
                                <span><i className="jol-dot-legend jol-self" /> Felt</span>
                                <span><i className="jol-dot-legend jol-measured" /> Showed</span>
                            </div>
                        </div>
                    )}

                    <div className="journey-block">
                        <h3 className="journey-h3">The next moves you set</h3>
                        <ul className="journey-moves">
                            {points.filter((p) => p.nextMove).slice().reverse().map((p) => (
                                <li key={p.id}>
                                    <span className="journey-move-date">{p.date}</span>
                                    <span className="journey-move-text">{p.nextMove}</span>
                                </li>
                            ))}
                            {points.every((p) => !p.nextMove) && (
                                <li style={{ color: '#9ca3af', listStyle: 'none' }}>Your next moves will appear here as you complete reflections.</li>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </CollapsibleSection>
    );
}
