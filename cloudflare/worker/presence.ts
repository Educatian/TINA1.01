/* ============================================================================
   TINA Worker — presence (replaces Supabase Realtime presence)

   One Durable Object instance per activity channel tracks who is currently
   connected and broadcasts the live roster over WebSocket. This is the last
   piece that kept TINA on Supabase; with it, presence ("N other learners
   active") runs entirely on Cloudflare.

   Browsers cannot set headers on a WebSocket handshake, so the client passes
   its JWT as a ?token= query param; index.ts verifies it before forwarding the
   upgrade to the room.
   ========================================================================== */

interface PresenceState { fetch(request: Request): Promise<Response>; }

export class PresenceRoom implements PresenceState {
    private sessions = new Map<WebSocket, { userId: string }>();

    // Cloudflare constructs DOs with (state, env); we keep neither.
    constructor(_state: unknown, _env: unknown) {}

    async fetch(request: Request): Promise<Response> {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('expected websocket', { status: 426 });
        }
        const userId = new URL(request.url).searchParams.get('uid') || 'anon';
        const pair = new (globalThis as any).WebSocketPair();
        const client = pair[0] as WebSocket;
        const server = pair[1] as WebSocket & { accept(): void };

        server.accept();
        this.sessions.set(server, { userId });
        this.broadcast();

        const drop = () => { this.sessions.delete(server); this.broadcast(); };
        server.addEventListener('close', drop);
        server.addEventListener('error', drop);

        return new Response(null, { status: 101, webSocket: client } as any);
    }

    private broadcast() {
        // Shape mirrors Supabase presenceState(): { userId: [meta], ... }
        const presence: Record<string, unknown[]> = {};
        for (const { userId } of this.sessions.values()) presence[userId] = [{}];
        const msg = JSON.stringify({ type: 'sync', presence });
        for (const ws of this.sessions.keys()) {
            try { ws.send(msg); } catch { this.sessions.delete(ws); }
        }
    }
}
