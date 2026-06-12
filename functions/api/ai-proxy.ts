/* ============================================================================
   TINA — SERVER-SIDE AI PROXY (Cloudflare Pages Function)

   The Cloudflare-hosted twin of netlify/functions/ai-proxy.mts. Same contract,
   same auth, same allowlists — but dependency-free (talks to the Gemini and
   HuggingFace REST APIs with plain fetch) so it runs natively on the Workers
   runtime that powers Pages Functions. The @google/genai SDK pulls Node APIs
   and does not run here, hence the direct REST port.

   HOSTING MODEL
   Web hosting moves to Cloudflare Pages; Supabase stays the database + auth.
   This function keeps the Gemini/HF keys server-side (Pages env / secrets) and
   verifies the learner's Supabase JWT, exactly like the Netlify version.

   ROUTE     POST /api/ai-proxy   (the client posts here on both hosts; Netlify
             redirects /api/ai-proxy -> /.netlify/functions/ai-proxy)
   CONTRACT  { kind: 'gemini-chat', model, contents, systemInstruction } -> streamed text
             { kind: 'gemini-json', model, contents, config }            -> { text }
             { kind: 'hf', task, model, inputs, parameters }             -> HF JSON passthrough
   AUTH      Authorization: Bearer <supabase access token>, verified against
             ${SUPABASE_URL}/auth/v1/user with the anon key.
   RATE      Best-effort per-user log in public.api_request_log under RLS,
             written with the user's OWN JWT (no service-role key). Missing
             table -> skip (same additive-migration pattern as the rest of TINA).

   ENV (Cloudflare Pages -> Settings -> Environment variables / Secrets)
     GEMINI_API_KEY · HF_API_KEY · SUPABASE_URL · SUPABASE_ANON_KEY
   ========================================================================== */

interface Env {
    GEMINI_API_KEY?: string;
    HF_API_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    // Legacy VITE_-prefixed fallbacks, so an env copied from Netlify still works.
    VITE_GEMINI_API_KEY?: string;
    VITE_HUGGINGFACE_API_KEY?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ALLOWED_GEMINI_MODELS = new Set(['gemini-2.5-flash']);
const ALLOWED_HF_MODELS = new Set([
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
    'j-hartmann/emotion-english-distilroberta-base',
    'facebook/bart-large-mnli',
]);
const ALLOWED_HF_TASKS = new Set(['text-classification', 'zero-shot-classification']);

const MAX_BODY_BYTES = 200_000;
const RATE_LIMIT_PER_HOUR = 900;

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function env(e: Env) {
    return {
        GEMINI_KEY: e.GEMINI_API_KEY || e.VITE_GEMINI_API_KEY || '',
        HF_KEY: e.HF_API_KEY || e.VITE_HUGGINGFACE_API_KEY || '',
        SUPABASE_URL: e.SUPABASE_URL || e.VITE_SUPABASE_URL || '',
        SUPABASE_ANON_KEY: e.SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY || '',
    };
}

async function verifyUser(token: string, supabaseUrl: string, anonKey: string): Promise<{ id: string } | null> {
    if (!token || !supabaseUrl || !anonKey) return null;
    try {
        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const user = await res.json();
        return user?.id ? { id: user.id } : null;
    } catch {
        return null;
    }
}

async function checkAndLogRate(token: string, userId: string, kind: string, supabaseUrl: string, anonKey: string): Promise<boolean> {
    if (!supabaseUrl || !anonKey) return true;
    const restHeaders = { apikey: anonKey, Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    try {
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const [countRes] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/api_request_log?select=id&created_at=gte.${encodeURIComponent(hourAgo)}`,
                { method: 'HEAD', headers: { ...restHeaders, Prefer: 'count=exact' } }),
            fetch(`${supabaseUrl}/rest/v1/api_request_log`, {
                method: 'POST',
                headers: { ...restHeaders, Prefer: 'return=minimal' },
                body: JSON.stringify({ user_id: userId, kind }),
            }),
        ]);
        if (countRes.status === 404) return true; // table not migrated yet
        const range = countRes.headers.get('content-range') || '';
        const total = Number(range.split('/')[1]);
        if (Number.isFinite(total) && total >= RATE_LIMIT_PER_HOUR) return false;
        return true;
    } catch {
        return true;
    }
}

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

function sanitizeContents(raw: unknown): Content[] | null {
    if (typeof raw === 'string') return [{ role: 'user', parts: [{ text: raw }] }];
    if (!Array.isArray(raw)) return null;
    const out: Content[] = [];
    for (const item of raw as any[]) {
        const role = item?.role === 'model' ? 'model' : 'user';
        const text = typeof item?.text === 'string'
            ? item.text
            : typeof item?.parts?.[0]?.text === 'string' ? item.parts[0].text : null;
        if (text === null) return null;
        out.push({ role, parts: [{ text }] });
    }
    return out;
}

// Gemini's responseSchema is an OpenAPI subset and rejects JSON-Schema-only
// keys like additionalProperties; strip them recursively.
function toGeminiSchema(schema: any): any {
    if (Array.isArray(schema)) return schema.map(toGeminiSchema);
    if (schema && typeof schema === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(schema)) {
            if (k === 'additionalProperties') continue;
            out[k] = toGeminiSchema(v);
        }
        return out;
    }
    return schema;
}

function extractDelta(chunk: any): string {
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((p: any) => p?.text || '').join('');
}

/** Stream Gemini's SSE response, re-emitting only the text deltas as plain text. */
async function streamGemini(model: string, contents: Content[], systemInstruction: string | undefined, key: string): Promise<Response> {
    const payload: any = { contents };
    if (systemInstruction) payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    const upstream = await fetch(`${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => '');
        return json(502, { error: 'gemini_error', detail: detail.slice(0, 300) });
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    const readable = new ReadableStream({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                    return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (!dataStr || dataStr === '[DONE]') continue;
                    try {
                        const delta = extractDelta(JSON.parse(dataStr));
                        if (delta) controller.enqueue(encoder.encode(delta));
                    } catch { /* partial JSON across chunks — keep buffering */ }
                }
            } catch (err) {
                controller.error(err);
            }
        },
    });
    return new Response(readable, {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
}

async function generateGeminiJson(model: string, contents: Content[], cfg: any, key: string): Promise<Response> {
    const generationConfig: any = {};
    if (typeof cfg.temperature === 'number') generationConfig.temperature = cfg.temperature;
    if (typeof cfg.responseMimeType === 'string') generationConfig.responseMimeType = cfg.responseMimeType;
    if (cfg.responseJsonSchema && typeof cfg.responseJsonSchema === 'object') {
        generationConfig.responseSchema = toGeminiSchema(cfg.responseJsonSchema);
        if (!generationConfig.responseMimeType) generationConfig.responseMimeType = 'application/json';
    }
    try {
        const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ contents, generationConfig }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) return json(502, { error: 'gemini_error', detail: String(data?.error?.message || res.status).slice(0, 300) });
        const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
        return json(200, { text });
    } catch (err: any) {
        return json(502, { error: 'gemini_error', detail: String(err?.message || err).slice(0, 300) });
    }
}

// Cloudflare Pages Function entry — POST only.
export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
    const { request } = context;
    const { GEMINI_KEY, HF_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = env(context.env);

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' });

    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json(400, { error: 'invalid_json' }); }

    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = await verifyUser(token, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!user) return json(401, { error: 'unauthorized' });

    const kind = String(body?.kind || '');
    const allowed = await checkAndLogRate(token, user.id, kind, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!allowed) return json(429, { error: 'rate_limited' });

    if (kind === 'gemini-chat' || kind === 'gemini-json') {
        if (!GEMINI_KEY) return json(503, { error: 'gemini_key_not_configured' });
        const model = String(body?.model || 'gemini-2.5-flash');
        if (!ALLOWED_GEMINI_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const contents = sanitizeContents(body?.contents);
        if (!contents || contents.length === 0) return json(400, { error: 'invalid_contents' });

        if (kind === 'gemini-chat') {
            const systemInstruction = typeof body?.systemInstruction === 'string' ? body.systemInstruction : undefined;
            return streamGemini(model, contents, systemInstruction, GEMINI_KEY);
        }
        const cfg = body?.config && typeof body.config === 'object' ? body.config : {};
        return generateGeminiJson(model, contents, cfg, GEMINI_KEY);
    }

    if (kind === 'hf') {
        if (!HF_KEY) return json(503, { error: 'hf_key_not_configured' });
        const task = String(body?.task || '');
        const model = String(body?.model || '');
        if (!ALLOWED_HF_TASKS.has(task)) return json(400, { error: 'task_not_allowed' });
        if (!ALLOWED_HF_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const inputs = body?.inputs;
        if (typeof inputs !== 'string' || inputs.length === 0 || inputs.length > 4000) return json(400, { error: 'invalid_inputs' });
        try {
            const hfRes = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${HF_KEY}`, 'content-type': 'application/json' },
                body: JSON.stringify({ inputs, parameters: body?.parameters && typeof body.parameters === 'object' ? body.parameters : undefined }),
            });
            const data = await hfRes.json().catch(() => null);
            if (!hfRes.ok) return json(502, { error: 'hf_error', detail: (data as any)?.error || hfRes.status });
            return json(200, { result: data });
        } catch (err: any) {
            return json(502, { error: 'hf_error', detail: String(err?.message || err).slice(0, 300) });
        }
    }

    return json(400, { error: 'unknown_kind' });
};

// A bare GET is handy for a health check / wrong-method guard.
export const onRequestGet = async (): Promise<Response> => json(405, { error: 'method_not_allowed' });
