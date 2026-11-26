import type { User } from '../types';

// Instructor/admin accounts. The dashboard's instructor view is gated by
// isAdmin; listing an email here grants it regardless of the profiles row, so
// access never depends on a DB write succeeding.
const OVERRIDE_ADMIN_EMAILS = new Set([
    'jewoong.moon@gmail.com',
    'hbae4@albany.edu', // Haesol Bae — ETAP608 instructor
]);

export function isOverrideAdminEmail(email: string | undefined) {
    return Boolean(email && OVERRIDE_ADMIN_EMAILS.has(email.toLowerCase()));
}

export function buildFallbackUser(sessionUser: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: { role?: string };
}): User {
    const email = sessionUser.email || '';
    // Session fallback roles use the established instructor allowlist only.
    // Profile roles are resolved separately by buildUser after the lookup.
    const role = isOverrideAdminEmail(email) ? 'admin' : 'user';

    return {
        id: sessionUser.id,
        email,
        role,
        created_at: sessionUser.created_at || new Date().toISOString(),
    };
}

