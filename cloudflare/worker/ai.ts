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

// ---------------------------------------------------------------------------
// DEMO MODE — when no Gemini key is configured, TINA still runs end-to-end so
// the public demo is instantly playable (no setup). The coaching engine already
// drives the flow deterministically; here we just render each move as a real
// reflective question. Set the GEMINI_API_KEY secret to switch to live Gemini.
// ---------------------------------------------------------------------------
const DEMO_BY_MOVE: Record<string, string> = {
    ELICIT_EXPERIENCE: "Let's start with something real. Can you think of one recent moment in your teaching where AI came up — a lesson you planned, work you graded, or a choice you weren't quite sure about?",
    LOOK_BACK: "Thank you for sharing that. As you look back on that moment, what were you actually hoping would happen?",
    NAME_ESSENTIAL: "It sounds like something that matters to you is sitting underneath this. Would you say it touches a value you hold as a teacher — maybe fairness, care, or honesty?",
    DEEPEN_REFLECTION: "Let's stay with that for a moment. Why does that matter to you — what would be at stake if it went the other way?",
    SCAFFOLD_WITH_STEM: "Try finishing this in your own words: \"What made that moment matter to me was ___.\" What comes up?",
    REFRAME_PERSPECTIVE: "If one of your students described this same moment, how do you think they would see it?",
    CONNECT_VALUE_TO_ACTION: "Here is a small one: what is one concrete thing you could try in your next class that honors that value?",
    AFFIRM_AND_HOLD: "That is completely understandable, and it is okay to feel unsure here. Take a breath — what feels most on your mind right now?",
};

const DEMO_GREETING = "Hello! I'm TINA, your reflective learning companion. I'm here to help you pause and notice your teaching values and how AI fits into your practice. Think of this as a quiet moment for yourself. Shall we start with what's been on your mind lately about AI in your teaching?";

const DEMO_REPORT = [
    "**TINA Reflection Report (10-minute Consultation)**",
    "",
    "**1) What Stood Out In Your Reflection**",
    "- Main pattern noticed: you kept returning to how AI fits with what you most value as a teacher.",
    "- Strengths that are emerging: an honest, questioning stance toward your own practice.",
    "- Tensions or open questions: balancing the convenience of AI with the kind of teacher you want to be.",
    "",
    "**2) Values Guiding You Right Now**",
    "- Care: you weigh how choices land on your students.",
    "- Honesty: you notice when something feels off and name it.",
    "- Growth: you treat uncertainty as a place to learn, not a verdict.",
    "",
    "**3) Your Current AI Approach**",
    "- Main Purpose: support for planning and routine tasks.",
    "- Control Level: you stay in the loop and review what AI produces.",
    "- Routines to Strengthen: making your own reasoning visible before you reach for a tool.",
    "",
    "**4) Practicum And Learner Impact**",
    "- Transparency: thinking about how you'd explain your AI use to a colleague or parent.",
    "- Fairness/Gap: noticing who has access and who does not.",
    "",
    "**5) Integrated Insight**",
    "Your sense of yourself as a teacher is quietly steering your AI choices. When a tool saves time, you still ask whether it serves your students and reflects your values — and that question is itself the work of a thoughtful professional.",
    "",
    "**6) Questions To Carry Forward**",
    "Q1: When AI gives an answer, who decides if it's right — you, the student, or the tool?",
    "Q2: How do I make effort and thinking visible when AI can produce instant results?",
    "Q3: Whose knowledge and perspective does the AI represent?",
    "",
    "**7) One Next Move**",
    "In your next class or planning task, try one small step where you show your own reasoning first, then use AI only to check or extend it.",
    "",
    "_(Demo mode: TINA is running without a connected AI model. Set the instance's Gemini key for fully personalized responses.)_",
].join("\n");

function demoReplyText(contents: { role: string; parts: { text: string }[] }[]): string {
    const lastUser = [...contents].reverse().find((c) => c.role === 'user');
    const text = lastUser?.parts?.[0]?.text || '';
    if (/start the session/i.test(text) && !/COACHING MOVE/.test(text)) return DEMO_GREETING;
    const m = /COACHING MOVE = ([A-Z_]+)/.exec(text);
    const move = m ? m[1] : null;
    if (move === 'CLOSE_SYNTHESIS') return DEMO_REPORT;
    if (move && DEMO_BY_MOVE[move]) return DEMO_BY_MOVE[move];
    return "Thank you for sharing that. What feels most important to you about it?";
}

function streamText(text: string): Response {
    const encoder = new TextEncoder();
    // Emit in small word-chunks so the client's typing effect still animates.
    const words = text.split(/(\s+)/);
    let i = 0;
    const readable = new ReadableStream({
        pull(controller) {
            if (i >= words.length) { controller.close(); return; }
            controller.enqueue(encoder.encode(words[i++]));
        },
    });
    return new Response(readable, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

// Real AI for the demo via Cloudflare Workers AI (free, keyless). Streams an
// open model's reply as plain-text deltas, with the scripted demo as a fallback
// if the binding is missing or errors so the demo never breaks.
const WORKERS_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';

async function handleWorkersAi(
    contents: { role: string; parts: { text: string }[] }[],
    systemInstruction: string | undefined,
    env: Env,
): Promise<Response> {
    if (!env.AI) return streamText(demoReplyText(contents));
    const messages = [
        ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
        ...contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts[0]?.text || '' })),
    ];
    try {
        const upstream: any = await env.AI.run(WORKERS_AI_MODEL, { messages, stream: true, max_tokens: 768 });
        const body: ReadableStream<Uint8Array> | undefined = upstream?.body || upstream;
        if (!body || typeof (body as any).getReader !== 'function') {
            // Non-streaming shape: { response: "..." }
            const text = typeof upstream?.response === 'string' ? upstream.response : demoReplyText(contents);
            return streamText(text);
        }
        const reader = (body as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = '';
        let emitted = false;
        const readable = new ReadableStream({
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                    if (!emitted) controller.enqueue(encoder.encode(demoReplyText(contents)));
                    controller.close();
                    return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const t = line.trim();
                    if (!t.startsWith('data:')) continue;
                    const payload = t.slice(5).trim();
                    if (!payload || payload === '[DONE]') continue;
                    try {
                        const delta = JSON.parse(payload)?.response;
                        if (delta) { emitted = true; controller.enqueue(encoder.encode(delta)); }
                    } catch { /* partial json across chunks */ }
                }
            },
        });
        return new Response(readable, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
    } catch {
        return streamText(demoReplyText(contents));
    }
}

export async function handleAi(body: any, env: Env): Promise<Response> {
    const GEMINI_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
    const HF_KEY = env.HF_API_KEY || env.VITE_HUGGINGFACE_API_KEY || '';
    const kind = String(body?.kind || '');

    if (kind === 'gemini-chat' || kind === 'gemini-json') {
        const model = String(body?.model || 'gemini-2.5-flash');
        if (!ALLOWED_GEMINI_MODELS.has(model)) return json(400, { error: 'model_not_allowed' });
        const contents = sanitizeContents(body?.contents);
        if (!contents || contents.length === 0) return json(400, { error: 'invalid_contents' });

        // No Gemini key -> demo runs on free Cloudflare Workers AI (real model,
        // rate-limited upstream). JSON extraction stays a no-op so the research
        // pipeline simply skips.
        if (!GEMINI_KEY) {
            if (kind === 'gemini-chat') {
                const sys = typeof body?.systemInstruction === 'string' ? body.systemInstruction : undefined;
                return handleWorkersAi(contents, sys, env);
            }
            return json(503, { error: 'gemini_key_not_configured' });
        }

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
