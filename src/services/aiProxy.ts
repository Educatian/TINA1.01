/* ============================================================================
   TINA — CLIENT FOR THE SERVER-SIDE AI PROXY

   All Gemini / HuggingFace traffic goes through /api/ai-proxy with the
   learner's Supabase access token. API keys never reach the browser.
   /api/ai-proxy is the Cloudflare Pages Function at functions/api/ai-proxy.ts.

   createProxyChat(...) is a drop-in replacement for the @google/genai Chat
   object previously used by ChatInterface: it keeps the conversation history
   client-side (exactly what the SDK Chat did) and exposes sendMessage().
   It additionally supports:
     - onChunk: live partial text while the model streams (typing effect)
     - rollbackLastExchange(): drop the last user+model pair from history, so
       a verifyRender regeneration does not pollute the model's context with
       the rejected attempt (one logical turn = one history exchange).
   ========================================================================== */

import { supabase } from '../lib/supabase';

const PROXY_URL = '/api/ai-proxy';

export class ProxyRateLimitError extends Error {
    constructor() {
        super('rate_limited');
        this.name = 'ProxyRateLimitError';
    }
}

async function getAccessToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
}

async function postProxy(payload: Record<string, unknown>): Promise<Response> {
    const token = await getAccessToken();
    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });
    if (res.status === 429) throw new ProxyRateLimitError();
    return res;
}

export interface ChatHistoryItem {
    role: 'user' | 'model';
    text: string;
}

export interface ProxyChat {
    sendMessage(args: { message: string; onChunk?: (textSoFar: string) => void }): Promise<{ text: string }>;
    rollbackLastExchange(): void;
    getHistory(): ChatHistoryItem[];
}

export function createProxyChat(options: {
    model?: string;
    systemInstruction: string;
    history?: ChatHistoryItem[];
}): ProxyChat {
    const model = options.model || 'gemini-2.5-flash';
    const history: ChatHistoryItem[] = [...(options.history || [])];

    return {
        getHistory() {
            return [...history];
        },
        rollbackLastExchange() {
            // Drop the trailing model reply and its user message (if present).
            if (history.length && history[history.length - 1].role === 'model') history.pop();
            if (history.length && history[history.length - 1].role === 'user') history.pop();
        },
        async sendMessage({ message, onChunk }) {
            const contents = [...history, { role: 'user' as const, text: message }];
            const res = await postProxy({
                kind: 'gemini-chat',
                model,
                systemInstruction: options.systemInstruction,
                contents,
            });
            if (!res.ok || !res.body) {
                let detail = '';
                try { detail = JSON.stringify(await res.json()); } catch { /* opaque */ }
                throw new Error(`ai_proxy_chat_failed_${res.status} ${detail}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let text = '';
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                text += decoder.decode(value, { stream: true });
                if (onChunk) onChunk(text);
            }
            text += decoder.decode();
            history.push({ role: 'user', text: message });
            history.push({ role: 'model', text });
            return { text };
        },
    };
}

/** One-shot structured/JSON generation (research extraction, summaries). */
export async function proxyGenerateContent(args: {
    model?: string;
    contents: string;
    config?: {
        temperature?: number;
        responseMimeType?: string;
        responseJsonSchema?: object;
    };
}): Promise<{ text: string }> {
    const res = await postProxy({
        kind: 'gemini-json',
        model: args.model || 'gemini-2.5-flash',
        contents: args.contents,
        config: args.config,
    });
    if (!res.ok) {
        let detail = '';
        try { detail = JSON.stringify(await res.json()); } catch { /* opaque */ }
        throw new Error(`ai_proxy_json_failed_${res.status} ${detail}`);
    }
    const data = await res.json();
    return { text: typeof data?.text === 'string' ? data.text : '' };
}

/** HuggingFace inference through the proxy. */
export async function proxyHf(args: {
    task: 'text-classification' | 'zero-shot-classification';
    model: string;
    inputs: string;
    parameters?: Record<string, unknown>;
}): Promise<any> {
    const res = await postProxy({ kind: 'hf', ...args });
    if (!res.ok) {
        let detail = '';
        try { detail = JSON.stringify(await res.json()); } catch { /* opaque */ }
        throw new Error(`ai_proxy_hf_failed_${res.status} ${detail}`);
    }
    const data = await res.json();
    let result = data?.result;
    // Raw HF text-classification returns [[{label,score},...]] — flatten one
    // level so callers keep the same shape the old @huggingface/inference
    // client produced.
    if (Array.isArray(result) && Array.isArray(result[0])) {
        result = result[0];
    }
    return result;
}
