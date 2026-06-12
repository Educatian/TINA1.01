export interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    // AI keys (server-side only; same fallbacks as the old Netlify function)
    GEMINI_API_KEY?: string;
    VITE_GEMINI_API_KEY?: string;
    HF_API_KEY?: string;
    VITE_HUGGINGFACE_API_KEY?: string;
    // Static assets binding (Cloudflare Pages provides env.ASSETS)
    ASSETS: { fetch: (req: Request) => Promise<Response> };
    ADMIN_EMAILS?: string;
}

// Minimal D1 types (avoids a @cloudflare/workers-types dependency at build time)
export interface D1Result<T = Record<string, unknown>> {
    results?: T[];
    success: boolean;
    meta?: unknown;
}
export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(col?: string): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
