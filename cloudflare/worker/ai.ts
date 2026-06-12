/* ============================================================================
   TINA Worker — AI proxy (Gemini + HuggingFace), dependency-free

   Talks to the Gemini and HuggingFace REST APIs with plain fetch, so the
   Worker bundle stays tiny and 100% workerd-native (no Node shims). Keys live
   in Worker env only. Auth + per-user rate limiting are enforced by index.ts
   before this runs. Model/task allowlists prevent an open relay.
   ========================================================================== */

import type { Env } from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ALLOWED_GEMINI_MODELS = new Set(['gemini-2.5-flash']);
const ALLOWED_HF_MODELS = new Set([
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
    'j-hartmann/emotion-english-distilroberta-base',
    'facebook/bart-large-mnli',
]);
const ALLOWED_HF_TASKS = new Set(['text-classification', 'zero-shot-classification']);

function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
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

export async function handleAi(body: any, env: Env): Promise<Response> {
    const GEMINI_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
    const HF_KEY = env.HF_API_KEY || env.VITE_HUGGINGFACE_API_KEY || '';
    const kind = String(body?.kind || '');

    if (kind === 'gemini-chat' || kind === 'gemini-json') {
        if (!GEMINI_KEY) return json(503, { error: 'gemini_key_not_configured' });
        const model = String(body?.model || 'gemini-2.5-flash');
        if (!ALLOWED_GEMINI_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const contents = sanitizeContents(body?.contents);
        if (!contents || contents.length === 0) return json(400, { error: 'invalid_contents' });

        const payload: any = { contents };
        if (kind === 'gemini-chat' && typeof body?.systemInstruction === 'string') {
            payload.system_instruction = { parts: [{ text: body.systemInstruction }] };
        }
        if (kind === 'gemini-json') {
            const cfg = body?.config && typeof body.config === 'object' ? body.config : {};
            payload.generationConfig = {
                ...(typeof cfg.temperature === 'number' ? { temperature: cfg.temperature } : {}),
                ...(typeof cfg.responseMimeType === 'string' ? { responseMimeType: cfg.responseMimeType } : {}),
                ...(cfg.responseJsonSchema && typeof cfg.responseJsonSchema === 'object'
                    ? { responseSchema: toGeminiSchema(cfg.responseJsonSchema) } : {}),
            };
        }

        if (kind === 'gemini-chat') {
            try {
                const upstream = await fetch(
                    `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
                    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) },
                );
                if (!upstream.ok || !upstream.body) {
                    const detail = await upstream.text().catch(() => '');
                    return json(502, { error: 'gemini_error', detail: detail.slice(0, 300) });
                }
                // Re-stream as plain text deltas (the client renders a typing effect).
                const reader = upstream.body.getReader();
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                let buffer = '';
                const readable = new ReadableStream({
                    async pull(controller) {
                        const { done, value } = await reader.read();
                        if (done) { controller.close(); return; }
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';
                        for (const line of lines) {
                            const t = line.trim();
                            if (!t.startsWith('data:')) continue;
                            const jsonStr = t.slice(5).trim();
                            if (!jsonStr || jsonStr === '[DONE]') continue;
                            try {
                                const delta = extractDelta(JSON.parse(jsonStr));
                                if (delta) controller.enqueue(encoder.encode(delta));
                            } catch { /* partial json across chunks — ignore */ }
                        }
                    },
                });
                return new Response(readable, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
            } catch (err: any) {
                return json(502, { error: 'gemini_error', detail: String(err?.message || err).slice(0, 300) });
            }
        }

        // gemini-json (non-streaming)
        try {
            const upstream = await fetch(
                `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_KEY}`,
                { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) },
            );
            const data: any = await upstream.json().catch(() => null);
            if (!upstream.ok) return json(502, { error: 'gemini_error', detail: JSON.stringify(data?.error || upstream.status).slice(0, 300) });
            const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || '';
            return json(200, { text });
        } catch (err: any) {
            return json(502, { error: 'gemini_error', detail: String(err?.message || err).slice(0, 300) });
        }
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
}
