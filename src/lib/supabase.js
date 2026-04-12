import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[Supabase] Missing environment variables.\n' +
    'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'See .env.example for reference.'
  )
}

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseKey  ?? 'placeholder-key'
)

/** Resolve a username to an email via the public RPC (works unauthenticated). */
export async function getEmailByUsername(username) {
  const { data, error } = await supabase.rpc('get_email_by_username', { p_username: username })
  if (error) throw error
  return data // returns email string or null
}
