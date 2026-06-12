/* ============================================================================
   TINA — Cloudflare Pages Worker (advanced mode, dist/_worker.js)

   One vendor: this Worker serves the API for the whole app on Cloudflare.
     /api/auth/*  — signup / login / me / logout (D1 + JWT, see auth.ts)
     /api/data    — guarded data RPC over D1 (RLS replacement, see data.ts)
     /api/ai      — Gemini/HF proxy (keys server-side, see ai.ts)
   Everything else falls through to the static Pages assets (env.ASSETS), with
   SPA fallback to index.html for client-side routes.
   ========================================================================== */

import type { Env } from './types';
import { authUser, hashPassword, verifyPassword, signJwt, verifyJwt } from './auth';
import { runDataOp, DataError, type DataOp } from './data';
import { handleAi } from './ai';
import { PresenceRoom } from './presence';

// Durable Object class must be exported from the Worker entry for Pages.
export { PresenceRoom };

const RATE_LIMIT_PER_HOUR = 900;

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function nowSec(): number { return Math.floor(Date.now() / 1000); }

function adminEmails(env: Env): Set<string> {
    return new Set((env.ADMIN_EMAILS || 'jewoong.moon@gmail.com').split(',').map((e) => e.trim().toLowerCase()));
}

async function readJson(req: Request): Promise<any> {
    const text = await req.text();
    if (text.length > 200_000) throw new DataError(413, 'payload_too_large');
    try { return JSON.parse(text); } catch { throw new DataError(400, 'invalid_json'); }
}

// ---- auth endpoints --------------------------------------------------------
async function handleAuth(path: string, req: Request, env: Env): Promise<Response> {
    if (path === 'me') {
        const claims = await authUser(req, env, nowSec());
        if (!claims) return json(200, { user: null });
        return json(200, { user: { id: claims.sub, email: claims.email, role: claims.role } });
    }
    if (path === 'logout') return json(200, { ok: true }); // stateless JWT: client drops it

    if (path === 'signup' || path === 'login') {
        const body = await readJson(req);
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!email || !email.includes('@') || password.length < 6) return json(400, { error: 'invalid_credentials' });

        if (path === 'signup') {
            const existing = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first();
            if (existing) return json(409, { error: 'email_taken' });
            const id = crypto.randomUUID();
            const { hash, salt } = await hashPassword(password);
            const role = adminEmails(env).has(email) ? 'admin' : 'user';
            await env.DB.prepare('INSERT INTO profiles (id, email, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?)')
                .bind(id, email, hash, salt, role).run();
            const token = await signJwt({ sub: id, email, role }, env.JWT_SECRET, nowSec());
            return json(200, { token, user: { id, email, role } });
        }

        // login
        const row = await env.DB.prepare('SELECT id, email, password_hash, password_salt, role FROM profiles WHERE email = ?')
            .bind(email).first<{ id: string; email: string; password_hash: string; password_salt: string; role: string }>();
        if (!row || !row.password_hash || !row.password_salt) return json(401, { error: 'invalid_login' });
        const ok = await verifyPassword(password, row.password_hash, row.password_salt);
        if (!ok) return json(401, { error: 'invalid_login' });
        const role = adminEmails(env).has(email) && row.role !== 'admin' ? 'admin' : row.role;
        const token = await signJwt({ sub: row.id, email: row.email, role }, env.JWT_SECRET, nowSec());
        return json(200, { token, user: { id: row.id, email: row.email, role } });
    }

    return json(404, { error: 'unknown_auth_route' });
}

// ---- per-user hourly rate limit for AI calls (best-effort) ------------------
async function underRateLimit(env: Env, userId: string, kind: string): Promise<boolean> {
    try {
        const hourAgo = new Date(Date.now() - 3600_000).toISOString();
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM api_request_log WHERE user_id = ? AND created_at >= ?')
            .bind(userId, hourAgo).first<{ n: number }>();
        await env.DB.prepare('INSERT INTO api_request_log (id, user_id, kind) VALUES (?, ?, ?)')
            .bind(crypto.randomUUID(), userId, kind).run();
        return !row || row.n < RATE_LIMIT_PER_HOUR;
    } catch {
        return true; // never block the class on telemetry failure
    }
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url);
        const { pathname } = url;

        try {
            if (pathname.startsWith('/api/auth/')) {
                if (req.method !== 'POST' && !pathname.endsWith('/me')) return json(405, { error: 'method' });
                return await handleAuth(pathname.slice('/api/auth/'.length), req, env);
            }

            if (pathname === '/api/data') {
                if (req.method !== 'POST') return json(405, { error: 'method' });
                const claims = await authUser(req, env, nowSec());
                if (!claims) return json(401, { error: 'unauthorized' });
                const op = (await readJson(req)) as DataOp;
                const result = await runDataOp(env.DB, op, claims);
                return json(200, { data: result });
            }

            if (pathname === '/api/ai') {
                if (req.method !== 'POST') return json(405, { error: 'method' });
                const claims = await authUser(req, env, nowSec());
                if (!claims) return json(401, { error: 'unauthorized' });
                const body = await readJson(req);
                if (!(await underRateLimit(env, claims.sub, String(body?.kind || '')))) {
                    return json(429, { error: 'rate_limited' });
                }
                return await handleAi(body, env);
            }

            // live presence: WebSocket upgrade -> per-channel Durable Object.
            // The browser can't set headers on the handshake, so the JWT comes
            // in as ?token=; we verify it, then forward to the room with ?uid=.
            if (pathname === '/api/presence') {
                if (!env.PRESENCE) return json(503, { error: 'presence_not_configured' });
                if (req.headers.get('Upgrade') !== 'websocket') return json(426, { error: 'expected_websocket' });
                const token = url.searchParams.get('token') || '';
                const claims = token ? await verifyJwt(token, env.JWT_SECRET, nowSec()) : null;
                if (!claims) return json(401, { error: 'unauthorized' });
                const channel = url.searchParams.get('channel') || 'default';
                const id = env.PRESENCE.idFromName(channel);
                const stub = env.PRESENCE.get(id);
                const forward = new URL(req.url);
                forward.searchParams.set('uid', claims.sub);
                return stub.fetch(new Request(forward.toString(), req));
            }

            // static assets + SPA fallback
            const asset = await env.ASSETS.fetch(req);
            if (asset.status === 404 && req.method === 'GET' && !pathname.startsWith('/api/')) {
                return env.ASSETS.fetch(new Request(new URL('/index.html', url), req));
            }
            return asset;
        } catch (err) {
            if (err instanceof DataError) return json(err.status, { error: err.message });
            return json(500, { error: 'internal', detail: String((err as any)?.message || err).slice(0, 200) });
        }
    },
};
