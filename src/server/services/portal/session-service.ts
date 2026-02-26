import type { SupabaseClient } from '@supabase/supabase-js'
import { hashPortalToken } from '@/lib/portal/tokens'

export async function getValidPortalSession(
  supabase: SupabaseClient,
  token: string
) {
  const tokenHash = hashPortalToken(token)
  const nowIso = new Date().toISOString()

  const { data: session, error } = await supabase
    .from('portal_sessions')
    .select('id, org_id, obra_id, portal_cliente_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .single()

  if (error || !session) {
    return { session: null, error: error?.message || 'Sessão inválida' }
  }

  await supabase
    .from('portal_sessions')
    .update({ last_accessed_at: nowIso })
    .eq('id', session.id)

  return { session, error: null }
}
