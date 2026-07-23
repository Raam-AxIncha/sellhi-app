// ============================================================================
// SellHi — Supabase ADMIN (service-role) client.
//
// Used ONLY by trusted server-side code that runs without a user session — the
// Stripe webhook. The service-role key BYPASSES Row-Level Security, so it may be
// used exclusively in server routes that never expose it to the browser. It is
// read from an env var (SUPABASE_SERVICE_ROLE_KEY) and never committed.
//
// Do NOT import this from any client component or from routes that serve HTML.
// ============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  if (!_admin) {
    _admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _admin;
}
