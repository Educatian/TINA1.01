import React, { useMemo, useState } from 'react';
import { buildConstellation, VIEW_W, VIEW_H } from '../services/reflectionConstellation';

/* ============================================================================
   ValuesConstellation — a learner-facing reflective mirror for the report.

   Draws the core values that surfaced this session as a small constellation
   around "you", with faint links from each value to the centre, and the
   belief-vs-practice / AI tension shown as the gap it pulls against. Built
   entirely from the report TINA already wrote (no new data). Hides itself when
   no values could be parsed, so it never shows an empty frame.

   Tapping/focusing a star reveals TINA's one-line observation for that value.
   ========================================================================== */

export function ValuesConstellation({ report }: { report: string | null | undefined }) {
    const { values, tension, center } = useMemo(() => buildConstellation(report), [report]);
    const [active, setActive] = useState<number | null>(null);

    if (values.length === 0) return null;

    const activeStar = active !== null ? values[active] : null;

    return (
        <div className="constellation">
            <h3 className="constellation-title">What guided you today</h3>
            <p className="constellation-sub">
                The values that surfaced in your reflection{tension ? ', and the tension they pull against' : ''}.
            </p>

            <svg
                className="constellation-svg"
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                role="img"
                aria-label={`A constellation of your values: ${values.map((v) => v.name).join(', ')}`}
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <radialGradient id="constellation-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#FCEFA1" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#FCEFA1" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* links from each value to the centre */}
                {values.map((v, i) => (
                    <line
                        key={`link-${i}`}
                        x1={center.x} y1={center.y} x2={v.x} y2={v.y}
                        className={`constellation-link ${active === i ? 'active' : ''}`}
                    />
                ))}

                {/* the tension: a dashed pull away from the centre + a spark */}
                {tension && (
                    <>
                        <line
                            x1={center.x} y1={center.y}
                            x2={center.x + 22} y2={center.y + 18}
                            className="constellation-tension-link"
                        />
                        <text x={center.x + 23} y={center.y + 20} className="constellation-spark" aria-hidden="true">⚡</text>
                    </>
                )}

                {/* centre — "you" */}
                <circle cx={center.x} cy={center.y} r="9" fill="url(#constellation-glow)" />
                <circle cx={center.x} cy={center.y} r="3.4" className="constellation-you" />
                <text x={center.x} y={center.y + 8.5} className="constellation-you-label" textAnchor="middle" aria-hidden="true">you</text>

                {/* value stars */}
                {values.map((v, i) => (
                    <g
                        key={`star-${i}`}
                        className={`constellation-star ${active === i ? 'active' : ''}`}
                        transform={`translate(${v.x} ${v.y})`}
                        tabIndex={0}
                        role="button"
                        aria-label={v.note ? `${v.name}: ${v.note}` : v.name}
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive((a) => (a === i ? null : a))}
                        onClick={() => setActive((a) => (a === i ? null : i))}
                    >
                        <circle r={2.6 + v.weight * 1.6} className="constellation-dot" />
                        <text
                            y={v.y > center.y ? 6.2 : -4}
                            textAnchor="middle"
                            className="constellation-label"
                        >
                            {v.name}
                        </text>
                    </g>
                ))}
            </svg>

            {/* TINA's observation for the focused value (calm reveal, no layout jump) */}
            <p className="constellation-note" aria-live="polite">
                {activeStar?.note
                    ? <><strong>{activeStar.name}.</strong> {activeStar.note}</>
                    : <span className="constellation-note-hint">Tap a value to see what TINA noticed.</span>}
            </p>

            {tension && (
                <div className="constellation-tension" role="note">
                    <span className="constellation-tension-eyebrow">⚡ The tension you’re holding</span>
                    <p>{tension}</p>
                </div>
            )}
        </div>
    );
}
