import { createClient } from '@supabase/supabase-js'
import { getRequestId } from './response'

export async function getApiUser(request: Request) {
  const requestId = getRequestId(request)
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Token de autenticação ausente', requestId }
  }

  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, error: 'Token inválido ou expirado', requestId }
  }

  const { data: memberships } = await supabase
    .from('org_membros')
    .select('org_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })

  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .maybeSingle()

  const activeMembership =
    memberships?.find((membership) => membership.org_id === profile?.org_id) ||
    memberships?.[0] ||
    null

  return {
    user,
    supabase,
    error: null,
    requestId,
    orgId: activeMembership?.org_id || null,
    role: activeMembership?.role || null,
    memberships: memberships || [],
    activeOrgId: activeMembership?.org_id || null,
  }
}
