import React, { useEffect, useRef, useState } from 'react';
import { TinaAvatar, type TinaAvatarState } from './TinaAvatar';

/* ============================================================================
   TinaIdleCompanion — a living TINA that idles through small behaviours
   (walk across, sit, look around, read, wave) on a calm loop, instead of a
   single static pose. Each step crossfades; the "walking" step drifts her
   horizontally. Under prefers-reduced-motion it shows one static pose with no
   cycling, keeping the reflection space quiet.
   ========================================================================== */

interface Behaviour {
    state: TinaAvatarState;
    /** ms to hold this behaviour before moving on. */
    dur: number;
    /** drift horizontally across the stage (walking). */
    walk?: 'right' | 'left';
}

// A gentle, varied loop. Kept slow so it reads as "alive", not busy.
const LOOP: Behaviour[] = [
    { state: 'waving', dur: 2600 },
    { state: 'idle', dur: 3200 },
    { state: 'looking', dur: 3000 },
    { state: 'walking', dur: 4200, walk: 'right' },
    { state: 'reading', dur: 4200 },
    { state: 'sitting', dur: 4600 },
    { state: 'thinking', dur: 3000 },
    { state: 'walking', dur: 4200, walk: 'left' },
    { state: 'idle', dur: 3000 },
];

function prefersReducedMotion(): boolean {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// Compact in-place loop (no horizontal drift) — for small spots like the
// progress bar, where the position is already meaningful (it tracks progress).
const LOOP_INPLACE: Behaviour[] = [
    { state: 'walking', dur: 3200 },
    { state: 'idle', dur: 3000 },
    { state: 'looking', dur: 3200 },
    { state: 'thinking', dur: 3000 },
    { state: 'reading', dur: 3600 },
];

interface TinaIdleCompanionProps {
    height?: number;
    /** horizontal drift amplitude for the walking step, px. */
    drift?: number;
    /** stay in place (cycle poses, no horizontal drift). */
    inPlace?: boolean;
    /** override the behaviour loop. */
    loop?: Behaviour[];
    className?: string;
}

export function TinaIdleCompanion({ height = 170, drift = 70, inPlace = false, loop, className = '' }: TinaIdleCompanionProps) {
    const seq = loop ?? (inPlace ? LOOP_INPLACE : LOOP);
    const [index, setIndex] = useState(0);
    const [pos, setPos] = useState(0); // current x, persists between walks
    const reduce = useRef(prefersReducedMotion());

    useEffect(() => {
        if (reduce.current) return; // static idle, no loop
        const step = seq[index % seq.length];
        if (!inPlace) {
            if (step.walk === 'right') setPos(drift);
            else if (step.walk === 'left') setPos(-drift);
        }
        const t = window.setTimeout(() => setIndex((i) => (i + 1) % seq.length), step.dur);
        return () => window.clearTimeout(t);
    }, [index, drift, inPlace, seq]);

    if (reduce.current) {
        return <TinaAvatar state="idle" height={height} className={className} />;
    }

    const b = seq[index % seq.length];
    const flip = !inPlace && b.walk === 'left'; // only mirror while roaming left
    const translate = inPlace ? 0 : pos;
    return (
        <div className={`tina-companion ${className}`.trim()} style={{ height: `${height}px` }} aria-hidden="true">
            <div
                className={`tina-companion-figure ${b.walk && !inPlace ? 'is-walking' : ''}`}
                style={{ transform: `translateX(${translate}px) scaleX(${flip ? -1 : 1})` }}
            >
                {/* key forces a remount so each behaviour gently fades in */}
                <TinaAvatar key={`${index}-${b.state}`} state={b.state} height={height} />
            </div>
        </div>
    );
}
