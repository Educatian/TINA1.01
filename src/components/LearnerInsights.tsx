import React, { useEffect, useState } from 'react';
import { getLearnerCoverage, type LearnerCoverage } from '../services/learnerInsights';
import { CollapsibleSection } from './CollapsibleSection';

/* ============================================================================
   LearnerInsights — coverage / tendency feedback for the learner.

   Surfaces the research signals already collected (which reflection layers and
   themes they engage) so the learner can SEE their own patterns and notice what
   they rarely reflect on. Hides itself when there is no telemetry yet.
   ========================================================================== */

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="coverage-row">
            <span className="coverage-label">{label}</span>
            <div className="coverage-track">
                <div className={`coverage-fill ${count === 0 ? 'coverage-empty' : ''}`} style={{ width: `${Math.max(pct, count === 0 ? 0 : 6)}%` }} />
            </div>
            <span className="coverage-count">{count}</span>
        </div>
    );
}

export function LearnerInsights({ userId }: { userId: string }) {
    const [data, setData] = useState<LearnerCoverage | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getLearnerCoverage(userId).then((d) => { if (!cancelled) setData(d); });
        return () => { cancelled = true; };
    }, [userId]);

    if (data === undefined) {
        return (
            <CollapsibleSection storageKey="patterns" title="Your Reflection Patterns" defaultOpen={false}>
                <p style={{ color: '#9ca3af' }}>Reading your patterns…</p>
            </CollapsibleSection>
        );
    }
    if (!data || data.totalTurns === 0) return null;

    const layerMax = Math.max(...data.layers.map((l) => l.count), 1);
    const themeMax = Math.max(...data.ethicalThemes.map((t) => t.count), 1);
    const ctxMax = Math.max(...data.practicumContexts.map((c) => c.count), 1);

    return (
        <CollapsibleSection
            storageKey="patterns"
            title="Your Reflection Patterns"
            summary={`${data.totalTurns} ${data.totalTurns === 1 ? 'turn' : 'turns'} analyzed`}
            defaultOpen={false}
        >
            <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                Across your reflections so far, here is where your attention has gone, and where there is room to explore.
            </p>

            <div className="journey-block">
                <h3 className="journey-h3">What you reflect on</h3>
                {data.layers.map((l) => <Bar key={l.key} label={l.label} count={l.count} max={layerMax} />)}
            </div>

            {data.leastExploredLayer && data.leastExploredLayer.count <= layerMax * 0.34 && (
                <div className="insight-nudge">
                    <strong>Worth exploring next:</strong> you have rarely reflected on{' '}
                    <em>{data.leastExploredLayer.label.toLowerCase()}</em>. A future session could start there.
                </div>
            )}

            {data.ethicalThemes.length > 0 && (
                <div className="journey-block">
                    <h3 className="journey-h3">Ethical themes you have raised</h3>
                    {data.ethicalThemes.map((t) => <Bar key={t.key} label={t.label} count={t.count} max={themeMax} />)}
                </div>
            )}

            {data.practicumContexts.length > 0 && (
                <div className="journey-block">
                    <h3 className="journey-h3">Where your reflections connect to practice</h3>
                    {data.practicumContexts.map((c) => <Bar key={c.key} label={c.label} count={c.count} max={ctxMax} />)}
                </div>
            )}
        </CollapsibleSection>
    );
}
