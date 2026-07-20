import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const userId = data.claims.sub as string
  const { data: profile } = await supabase.from('profiles').select('role, display_name, player_id').eq('user_id', userId).maybeSingle()
  return { supabase, userId, profile }
}
