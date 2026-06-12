/* ============================================================================
   TINA — Cloudflare client (supabase-js-compatible shim)

   Drop-in replacement for the small subset of @supabase/supabase-js the app
   uses, so the migration to Cloudflare (D1 + Worker auth) needs no changes in
   the feature code. Every `.from(table)...` chain compiles to ONE op and POSTs
   to /api/data; auth talks to /api/auth/*; tokens are stateless JWTs in
   localStorage. Realtime presence is a no-op for now (Durable Objects follow-up).
   ========================================================================== */

const TOKEN_KEY = 'tina-cf-token';

function getToken(): string {
    try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(token: string | null) {
    try {
        if (token) window.localStorage.setItem(TOKEN_KEY, token);
        else window.localStorage.removeItem(TOKEN_KEY);
    } catch { /* private mode */ }
}

interface AuthUser {
    id: string;
    email: string;
    created_at?: string;
    user_metadata?: { role?: string };
}

function decodeClaims(token: string): { sub: string; email: string; role: string; exp: number } | null {
    try {
        const payload = token.split('.')[1];
        const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        const c = JSON.parse(json);
        if (!c?.sub || !c?.exp || c.exp < Math.floor(Date.now() / 1000)) return null;
        return c;
    } catch {
        return null;
    }
}

function userFromToken(token: string): AuthUser | null {
    const c = decodeClaims(token);
    if (!c) return null;
    return { id: c.sub, email: c.email, user_metadata: { role: c.role } };
}

type Listener = (event: string, session: { user: AuthUser } | null) => void;
const listeners = new Set<Listener>();
function emit(event: string, user: AuthUser | null) {
    const session = user ? { user } : null;
    for (const cb of listeners) { try { cb(event, session); } catch { /* ignore */ } }
}

async function authPost(route: string, body: unknown) {
    const res = await fetch(`/api/auth/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// ---- query builder ---------------------------------------------------------
interface Filter { col: string; op: 'eq' | 'isNull' | 'isNotNull'; value?: unknown }

class QueryBuilder<T = any> implements PromiseLike<{ data: T; error: { message: string; code?: string } | null }> {
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null = null;
    private columns = '*';
    private valueObj: Record<string, unknown> | undefined;
    private conflict: string | undefined;
    private filters: Filter[] = [];
    private orderBy: { col: string; ascending: boolean } | undefined;
    private limitN: number | undefined;
    private representation = false;
    private mode: 'many' | 'single' | 'maybeSingle' = 'many';
    private embed: { as: string; table: string; fk: string } | undefined;

    constructor(private table: string) {}

    select(columns = '*') {
        // embed syntax: "...,activity:activities(*)"
        const m = /(\w+)\s*:\s*activities\s*\(\*\)/.exec(columns);
        if (m) { this.embed = { as: m[1], table: 'activities', fk: 'activity_id' }; this.columns = '*'; }
        else this.columns = columns;
        if (this.op === null) this.op = 'select';
        else this.representation = true;
        return this;
    }
    insert(values: Record<string, unknown>) { this.op = 'insert'; this.valueObj = values; return this; }
    update(values: Record<string, unknown>) { this.op = 'update'; this.valueObj = values; return this; }
    upsert(values: Record<string, unknown>, opts?: { onConflict?: string }) {
        this.op = 'upsert'; this.valueObj = values; this.conflict = opts?.onConflict; return this;
    }
    delete() { this.op = 'delete'; return this; }
    eq(col: string, value: unknown) { this.filters.push({ col, op: 'eq', value }); return this; }
    is(col: string, value: unknown) { this.filters.push({ col, op: value === null ? 'isNull' : 'eq', value }); return this; }
    not(col: string, operator: string, value: unknown) {
        if (operator === 'is' && value === null) this.filters.push({ col, op: 'isNotNull' });
        return this;
    }
    order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, ascending: opts?.ascending !== false }; return this; }
    limit(n: number) { this.limitN = n; return this; }
    single() { this.mode = 'single'; return this; }
    maybeSingle() { this.mode = 'maybeSingle'; return this; }

    private async execute(): Promise<{ data: any; error: { message: string; code?: string } | null }> {
        const opPayload = {
            table: this.table,
            op: this.op || 'select',
            columns: this.columns,
            values: this.valueObj,
            onConflict: this.conflict,
            filters: this.filters,
            order: this.orderBy,
            limit: this.limitN,
            representation: this.representation,
            embed: this.embed,
        };
        let res: Response;
        try {
            res = await fetch('/api/data', {
                method: 'POST',
                headers: { 'content-type': 'application/json', Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify(opPayload),
            });
        } catch (e) {
            return { data: null, error: { message: `network_error: ${String(e)}` } };
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok || (body as any).error) {
            return { data: null, error: { message: (body as any).error || `http_${res.status}`, code: String(res.status) } };
        }
        let rows: any[] = (body as any).data || [];
        const isWrite = this.op && this.op !== 'select';
        if (isWrite && !this.representation) return { data: null, error: null };
        if (this.mode === 'single') {
            if (rows.length === 0) return { data: null, error: { message: 'no_rows', code: 'PGRST116' } };
            return { data: rows[0], error: null };
        }
        if (this.mode === 'maybeSingle') return { data: rows[0] ?? null, error: null };
        return { data: rows, error: null };
    }

    then<R1 = any, R2 = never>(
        onfulfilled?: ((v: { data: T; error: { message: string; code?: string } | null }) => R1 | PromiseLike<R1>) | null,
        onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
    ): PromiseLike<R1 | R2> {
        return this.execute().then(onfulfilled as any, onrejected);
    }
}

// ---- presence channel (no-op until Durable Objects) ------------------------
function makeChannel() {
    const channel = {
        on() { return channel; },
        subscribe(cb?: (status: string) => void) { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return channel; },
        track: async () => ({}),
        untrack: async () => ({}),
        presenceState: () => ({}),
    };
    return channel;
}

// ---- the exported client ---------------------------------------------------
export const cfClient = {
    from<T = any>(table: string) { return new QueryBuilder<T>(table); },

    auth: {
        async getSession() {
            const token = getToken();
            const user = token ? userFromToken(token) : null;
            if (token && !user) setToken(null); // expired
            return { data: { session: user ? { access_token: token, user } : null }, error: null };
        },
        async getUser() {
            const user = userFromToken(getToken());
            return { data: { user }, error: null };
        },
        async signInWithPassword({ email, password }: { email: string; password: string }) {
            const { ok, data } = await authPost('login', { email, password });
            if (!ok) return { data: { user: null, session: null }, error: { message: data?.error || 'login_failed' } };
            setToken(data.token);
            const user = userFromToken(data.token);
            emit('SIGNED_IN', user);
            return { data: { user, session: { access_token: data.token, user } }, error: null };
        },
        async signUp({ email, password }: { email: string; password: string }) {
            const { ok, data } = await authPost('signup', { email, password });
            if (!ok) return { data: { user: null, session: null }, error: { message: data?.error || 'signup_failed' } };
            setToken(data.token);
            const user = userFromToken(data.token);
            emit('SIGNED_IN', user);
            return { data: { user, session: { access_token: data.token, user } }, error: null };
        },
        async signOut() {
            setToken(null);
            emit('SIGNED_OUT', null);
            return { error: null };
        },
        onAuthStateChange(cb: Listener) {
            listeners.add(cb);
            return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
        },
    },

    channel: (_name: string, _opts?: unknown) => makeChannel(),
    removeChannel: async (_ch: unknown) => ({}),
};

export type CfClient = typeof cfClient;
