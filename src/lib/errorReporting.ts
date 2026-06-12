/* ============================================================================
   TINA — error reporting (Sentry, opt-in + lazy)

   Sentry is loaded ONLY when VITE_SENTRY_DSN is configured, and even then it is
   dynamically imported so it never weighs down the main bundle for deployments
   that don't use it. captureError() degrades to console when Sentry is absent.
   ========================================================================== */

let sentry: any = null;
let initStarted = false;

export async function initErrorReporting(): Promise<void> {
    const dsn = (import.meta as any).env?.VITE_SENTRY_DSN;
    if (!dsn || initStarted) return;
    initStarted = true;
    try {
        const Sentry = await import('@sentry/browser');
        Sentry.init({
            dsn,
            tracesSampleRate: 0,
            // keep it lean: errors + unhandled rejections only
            environment: (import.meta as any).env?.MODE || 'production',
        });
        sentry = Sentry;
    } catch (e) {
        console.warn('Sentry init failed (continuing without it):', e);
    }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
    if (sentry) {
        sentry.captureException(error, context ? { extra: context } : undefined);
    } else {
        console.error('[tina] error:', error, context || '');
    }
}

/** Heuristic: a network / backend-unreachable failure (e.g. Supabase paused). */
export function isConnectivityError(error: unknown): boolean {
    const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed') ||
        msg.includes('err_name_not_resolved') ||
        msg.includes('fetch')
    );
}
