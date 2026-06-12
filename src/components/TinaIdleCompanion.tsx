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

interface TinaIdleCompanionProps {
    height?: number;
    /** horizontal drift amplitude for the walking step, px. */
    drift?: number;
    className?: string;
}

export function TinaIdleCompanion({ height = 170, drift = 70, className = '' }: TinaIdleCompanionProps) {
    const [index, setIndex] = useState(0);
    const [pos, setPos] = useState(0); // current x, persists between walks
    const reduce = useRef(prefersReducedMotion());

    useEffect(() => {
        if (reduce.current) return; // static idle, no loop
        const step = LOOP[index];
        if (step.walk === 'right') setPos(drift);
        else if (step.walk === 'left') setPos(-drift);
        const t = window.setTimeout(() => setIndex((i) => (i + 1) % LOOP.length), step.dur);
        return () => window.clearTimeout(t);
    }, [index, drift]);

    if (reduce.current) {
        return <TinaAvatar state="idle" height={height} className={className} />;
    }

    const b = LOOP[index];
    const flip = b.walk === 'left'; // only mirror while walking left
    return (
        <div className={`tina-companion ${className}`.trim()} style={{ height: `${height}px` }} aria-hidden="true">
            <div
                className={`tina-companion-figure ${b.walk ? 'is-walking' : ''}`}
                style={{ transform: `translateX(${pos}px) scaleX(${flip ? -1 : 1})` }}
            >
                {/* key forces a remount so each behaviour gently fades in */}
                <TinaAvatar key={`${index}-${b.state}`} state={b.state} height={height} />
            </div>
        </div>
    );
}
