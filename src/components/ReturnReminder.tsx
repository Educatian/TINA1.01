import React, { useEffect, useState } from 'react';
import { getReturningLearnerContext, type ReturningLearnerContext } from '../services/reflectionLoop';

/* ============================================================================
   ReturnReminder — a gentle "welcome back" nudge shown before a returning
   learner starts, surfacing the commitment ("One Next Move") they made last
   time so a single session becomes a habit. Reuses the cross-session loop data;
   hides itself for first-time learners or when there is no commitment.
   ========================================================================== */

function daysSince(iso: string | null): number | null {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 86_400_000);
}

export function ReturnReminder({ userId }: { userId: string }) {
    const [ctx, setCtx] = useState<ReturningLearnerContext | null>(null);

    useEffect(() => {
        let cancelled = false;
        getReturningLearnerContext(userId).then((c) => { if (!cancelled) setCtx(c); });
        return () => { cancelled = true; };
    }, [userId]);

    if (!ctx || !ctx.nextMove) return null;
    const d = daysSince(ctx.completedAt);
    // Only nudge once a little time has passed — same-day return needs no reminder.
    if (d !== null && d < 1) return null;

    const whenText = d === null ? 'Last time' : d === 1 ? 'Yesterday' : `${d} days ago`;

    return (
        <div className="return-reminder">
            <div className="return-reminder-eyebrow">Welcome back 👋</div>
            <p className="return-reminder-body">
                {whenText} you planned to try: <em>“{ctx.nextMove}”</em>
            </p>
            <p className="return-reminder-cta">When you start, TINA will check in on how it went.</p>
        </div>
    );
}
