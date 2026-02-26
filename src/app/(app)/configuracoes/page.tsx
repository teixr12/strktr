import { createClient } from '@/lib/supabase/server'
import { OrgSettingsContent } from '@/components/configuracoes/org-settings'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let orgMembro = null
  let orgMembros: unknown[] = []
  let organizacao = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: memberships } = await supabase
      .from('org_membros')
      .select('*, organizacoes(id, nome, cnpj, plano, created_at, updated_at)')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: true })

    const membro = memberships?.find((membership) => membership.org_id === profile?.org_id) || memberships?.[0] || null
    orgMembro = membro

    if (membro?.org_id) {
      organizacao = membro.organizacoes

      // Get all org members (only if user is admin/manager)
      if (membro.role === 'admin' || membro.role === 'manager') {
        const { data: membros } = await supabase
          .from('org_membros')
          .select('*')
          .eq('org_id', membro.org_id)
          .order('created_at')

        const userIds = (membros ?? []).map((item) => item.user_id)
        const { data: profiles } = userIds.length
          ? await supabase
              .from('profiles')
              .select('id, nome, email')
              .in('id', userIds)
          : { data: [] }

        const profilesMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
        orgMembros = (membros ?? []).map((item) => ({
          ...item,
          profiles: profilesMap.get(item.user_id)
            ? {
                nome: profilesMap.get(item.user_id)?.nome || 'Usuário',
                email: profilesMap.get(item.user_id)?.email || null,
              }
            : null,
        }))
      }
    }
  }

  return (
    <OrgSettingsContent
      userId={user?.id || ''}
      orgMembro={orgMembro}
      orgMembros={orgMembros as never[]}
      organizacao={organizacao}
    />
  )
}
