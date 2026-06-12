/* ============================================================================
   TINA Worker — authentication (replaces Supabase Auth)

   Email/password self-serve signup on D1 + stateless HMAC-SHA256 JWTs, all via
   the Web Crypto API (no dependencies). Passwords are stored as PBKDF2-SHA256
   (210k iterations) over a per-user random salt. The JWT mirrors the claim
   shape the rest of the app already reads from a Supabase token: { sub, email,
   role, exp }.
   ========================================================================== */

import type { Env } from './types';

const enc = new TextEncoder();
// Cloudflare Workers' Web Crypto caps PBKDF2 at 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000;
const JWT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ---- base64url -------------------------------------------------------------
function b64urlFromBytes(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(s: string): string {
    return b64urlFromBytes(enc.encode(s));
}
function bytesFromB64url(s: string): Uint8Array {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// ---- password hashing ------------------------------------------------------
export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
    const salt = saltB64 ? bytesFromB64url(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        key,
        256,
    );
    return { hash: b64urlFromBytes(new Uint8Array(bits)), salt: b64urlFromBytes(salt) };
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const { hash: candidate } = await hashPassword(password, salt);
    return timingSafeEqual(candidate, hash);
}

// ---- JWT (HS256) -----------------------------------------------------------
async function hmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface JwtClaims {
    sub: string;
    email: string;
    role: string;
    exp: number;
}

export async function signJwt(claims: Omit<JwtClaims, 'exp'>, secret: string, nowSec: number): Promise<string> {
    const header = b64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64urlFromString(JSON.stringify({ ...claims, exp: nowSec + JWT_TTL_SECONDS }));
    const data = `${header}.${payload}`;
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
    return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string, nowSec: number): Promise<JwtClaims | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const ok = await crypto.subtle.verify(
        'HMAC',
        await hmacKey(secret),
        bytesFromB64url(sig),
        enc.encode(`${header}.${payload}`),
    );
    if (!ok) return null;
    try {
        const claims = JSON.parse(new TextDecoder().decode(bytesFromB64url(payload))) as JwtClaims;
        if (!claims.sub || !claims.exp || claims.exp < nowSec) return null;
        return claims;
    } catch {
        return null;
    }
}

export function bearer(req: Request): string {
    return (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

/** Resolve the authenticated user from the request, or null. */
export async function authUser(req: Request, env: Env, nowSec: number): Promise<JwtClaims | null> {
    const token = bearer(req);
    if (!token || !env.JWT_SECRET) return null;
    return verifyJwt(token, env.JWT_SECRET, nowSec);
}
