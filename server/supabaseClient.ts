import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Service-role client. This key bypasses row-level security, so it must never
 * reach the browser: it is read from a non-`VITE_` env var and used only in
 * `server/` and `api/`.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
