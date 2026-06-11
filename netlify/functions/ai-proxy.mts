/* ============================================================================
   TINA — SERVER-SIDE AI PROXY (Netlify Function v2)

   WHY THIS EXISTS
   Before this function, VITE_GEMINI_API_KEY and VITE_HUGGINGFACE_API_KEY were
   compiled into the public JS bundle: anyone could extract and abuse them.
   This function keeps both keys server-side. The browser never sees them.

   CONTRACT  (POST /.netlify/functions/ai-proxy, JSON body)
     { kind: 'gemini-chat',  model, contents, systemInstruction }   -> streamed text
     { kind: 'gemini-json',  model, contents, config }              -> { text }
     { kind: 'hf',           task, model, inputs, parameters }      -> HF JSON passthrough

   AUTH
   Every request must carry a Supabase access token (Authorization: Bearer).
   It is verified against ${SUPABASE_URL}/auth/v1/user with the anon key.

   RATE LIMIT  (best-effort, feature-detected)
   Per-user request log in public.api_request_log (see tina-api-proxy.sql),
   written with the USER'S OWN JWT under RLS (no service-role key anywhere).
   If the table has not been created yet, rate limiting is skipped and the
   proxy still works — same additive-migration pattern as coaching_turns.

   ENV (server-side; Netlify already has the VITE_-prefixed values set, so the
   proxy works on first deploy with zero dashboard changes)
     GEMINI_API_KEY  || VITE_GEMINI_API_KEY
     HF_API_KEY      || VITE_HUGGINGFACE_API_KEY
     SUPABASE_URL    || VITE_SUPABASE_URL
     SUPABASE_ANON_KEY || VITE_SUPABASE_ANON_KEY
   ========================================================================== */

import { GoogleGenAI } from '@google/genai';

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const HF_KEY = process.env.HF_API_KEY || process.env.VITE_HUGGINGFACE_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Model allowlists — a leaked endpoint must not become a free arbitrary-model relay.
const ALLOWED_GEMINI_MODELS = new Set(['gemini-2.5-flash']);
const ALLOWED_HF_MODELS = new Set([
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
    'j-hartmann/emotion-english-distilroberta-base',
    'facebook/bart-large-mnli',
]);
const ALLOWED_HF_TASKS = new Set(['text-classification', 'zero-shot-classification']);

const MAX_BODY_BYTES = 200_000;          // a 12-turn transcript fits comfortably
const RATE_LIMIT_PER_HOUR = 900;         // ~10 full sessions/hour per user; blocks abuse, never a real class

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

async function verifyUser(token: string): Promise<{ id: string } | null> {
    if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const user = await res.json();
        return user?.id ? { id: user.id } : null;
    } catch {
        return null;
    }
}

/**
 * Best-effort per-user rate limit using the user's own JWT under RLS.
 * Returns true when the request may proceed. Missing table => proceed.
 */
async function checkAndLogRate(token: string, userId: string, kind: string): Promise<boolean> {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true;
    const restHeaders = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
    };
    try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const [countRes] = await Promise.all([
            fetch(
                `${SUPABASE_URL}/rest/v1/api_request_log?select=id&created_at=gte.${encodeURIComponent(hourAgo)}`,
                { method: 'HEAD', headers: { ...restHeaders, Prefer: 'count=exact' } },
            ),
            fetch(`${SUPABASE_URL}/rest/v1/api_request_log`, {
                method: 'POST',
                headers: { ...restHeaders, Prefer: 'return=minimal' },
                body: JSON.stringify({ user_id: userId, kind }),
            }),
        ]);
        if (countRes.status === 404) return true; // table not migrated yet — feature-detect
        const range = countRes.headers.get('content-range') || '';
        const total = Number(range.split('/')[1]);
        if (Number.isFinite(total) && total >= RATE_LIMIT_PER_HOUR) return false;
        return true;
    } catch {
        return true; // never block the live class on telemetry failure
    }
}

type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };

function sanitizeContents(raw: unknown): GeminiContent[] | null {
    if (typeof raw === 'string') {
        return [{ role: 'user', parts: [{ text: raw }] }];
    }
    if (!Array.isArray(raw)) return null;
    const out: GeminiContent[] = [];
    for (const item of raw) {
        const role = item?.role === 'model' ? 'model' : 'user';
        const text = typeof item?.text === 'string'
            ? item.text
            : typeof item?.parts?.[0]?.text === 'string' ? item.parts[0].text : null;
        if (text === null) return null;
        out.push({ role, parts: [{ text }] });
    }
    return out;
}

export default async (req: Request) => {
    if (req.method !== 'POST') {
        return json(405, { error: 'method_not_allowed' });
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
        return json(413, { error: 'payload_too_large' });
    }

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return json(400, { error: 'invalid_json' });
    }

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = await verifyUser(token);
    if (!user) {
        return json(401, { error: 'unauthorized' });
    }

    const kind = String(body?.kind || '');
    const allowed = await checkAndLogRate(token, user.id, kind);
    if (!allowed) {
        return json(429, { error: 'rate_limited' });
    }

    // ------------------------------------------------------------------ Gemini
    if (kind === 'gemini-chat' || kind === 'gemini-json') {
        if (!GEMINI_KEY) return json(503, { error: 'gemini_key_not_configured' });
        const model = String(body?.model || 'gemini-2.5-flash');
        if (!ALLOWED_GEMINI_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const contents = sanitizeContents(body?.contents);
        if (!contents || contents.length === 0) return json(400, { error: 'invalid_contents' });

        const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

        if (kind === 'gemini-chat') {
            const systemInstruction = typeof body?.systemInstruction === 'string' ? body.systemInstruction : undefined;
            try {
                // Stream plain-text chunks: first byte arrives fast (Netlify 10s
                // budget) and the client can render a live typing effect.
                const stream = await ai.models.generateContentStream({
                    model,
                    contents,
                    config: systemInstruction ? { systemInstruction } : undefined,
                });
                const encoder = new TextEncoder();
                const readable = new ReadableStream({
                    async start(controller) {
                        try {
                            for await (const chunk of stream) {
                                const text = chunk?.text;
                                if (text) controller.enqueue(encoder.encode(text));
                            }
                            controller.close();
                        } catch (err) {
                            controller.error(err);
                        }
                    },
                });
                return new Response(readable, {
                    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
                });
            } catch (err: any) {
                return json(502, { error: 'gemini_error', detail: String(err?.message || err).slice(0, 300) });
            }
        }

        // gemini-json: small structured-extraction calls; non-streaming.
        try {
            const cfg = body?.config && typeof body.config === 'object' ? body.config : {};
            const response = await ai.models.generateContent({
                model,
                contents,
                config: {
                    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : undefined,
                    responseMimeType: typeof cfg.responseMimeType === 'string' ? cfg.responseMimeType : undefined,
                    responseJsonSchema: cfg.responseJsonSchema && typeof cfg.responseJsonSchema === 'object'
                        ? cfg.responseJsonSchema
                        : undefined,
                },
            });
            return json(200, { text: response.text || '' });
        } catch (err: any) {
            return json(502, { error: 'gemini_error', detail: String(err?.message || err).slice(0, 300) });
        }
    }

    // ---------------------------------------------------------------- HF NLP
    if (kind === 'hf') {
        if (!HF_KEY) return json(503, { error: 'hf_key_not_configured' });
        const task = String(body?.task || '');
        const model = String(body?.model || '');
        if (!ALLOWED_HF_TASKS.has(task)) return json(400, { error: 'task_not_allowed' });
        if (!ALLOWED_HF_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const inputs = body?.inputs;
        if (typeof inputs !== 'string' || inputs.length === 0 || inputs.length > 4000) {
            return json(400, { error: 'invalid_inputs' });
        }
        try {
            const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${HF_KEY}`,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    inputs,
                    parameters: body?.parameters && typeof body.parameters === 'object' ? body.parameters : undefined,
                }),
            });
            const data = await hfRes.json().catch(() => null);
            if (!hfRes.ok) {
                return json(502, { error: 'hf_error', detail: data?.error || hfRes.status });
            }
            return json(200, { result: data });
        } catch (err: any) {
            return json(502, { error: 'hf_error', detail: String(err?.message || err).slice(0, 300) });
        }
    }

    return json(400, { error: 'unknown_kind' });
};
