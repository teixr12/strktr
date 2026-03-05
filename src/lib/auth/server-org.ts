import type { SupabaseClient, User } from '@supabase/supabase-js'

type ActiveMembershipRow = {
  org_id: string
  role: string
  status: string
}

export type ServerActiveOrgContext = {
  user: User | null
  orgId: string | null
  role: string | null
  memberships: ActiveMembershipRow[]
}

export async function getServerActiveOrgContext(
  supabase: SupabaseClient
): Promise<ServerActiveOrgContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      orgId: null,
      role: null,
      memberships: [],
    }
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle(),
    supabase
      .from('org_membros')
      .select('org_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true }),
  ])

  const normalizedMemberships = (memberships || []) as ActiveMembershipRow[]
  const activeMembership =
    normalizedMemberships.find((membership) => membership.org_id === profile?.org_id) ||
    normalizedMemberships[0] ||
    null

  return {
    user,
    orgId: activeMembership?.org_id || null,
    role: activeMembership?.role || null,
    memberships: normalizedMemberships,
  }
}

export async function getServerActiveOrgId(supabase: SupabaseClient): Promise<string | null> {
  const ctx = await getServerActiveOrgContext(supabase)
  return ctx.orgId
}
