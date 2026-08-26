import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Public config — safe to ship in the client bundle (Row-Level Security guards
// the data, not the key). When absent, the app runs entirely local-only.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const cloudEnabled = Boolean(url && anon)

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url as string, anon as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
