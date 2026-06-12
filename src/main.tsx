import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initErrorReporting } from './lib/errorReporting';

// Opt-in error monitoring (no-op unless VITE_SENTRY_DSN is set).
void initErrorReporting();

// PWA: register the service worker for an offline-resilient app shell.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell is best-effort */ });
    });
}

const root = createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
