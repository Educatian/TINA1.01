/* Cloudflare migration: the app now runs entirely on Cloudflare (Pages + Worker
   + D1). This module used to create a Supabase client; it now re-exports the
   supabase-js-compatible Cloudflare shim (src/lib/cfClient.ts) under the same
   `supabase` name, so no feature code had to change. */
import { cfClient } from './cfClient';

export const supabase = cfClient;

// Auth + data are always available through the same-origin Worker, so there is
// no separate "is configured" gate any more.
export const hasSupabaseConfig = true;
