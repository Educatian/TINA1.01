import React from 'react';
import { captureError } from '../lib/errorReporting';

/* ============================================================================
   ErrorBoundary — a render-time crash shows a calm, on-brand recovery screen
   instead of a white page, and reports to Sentry (when configured). Used at the
   app root so a bug in any screen never strands a learner mid-class.
   ========================================================================== */

interface State { hasError: boolean; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        captureError(error, { componentStack: info.componentStack });
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="app-crash">
                <img src="/tina-mascot.png" alt="TINA" width="96" height="96" className="app-crash-mascot" />
                <h1>Something hiccuped</h1>
                <p>TINA ran into a small problem on this screen. Reloading usually sorts it out, your saved reflections are safe.</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
            </div>
        );
    }
}
