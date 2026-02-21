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
    // Get user's org membership
    const { data: membro } = await supabase
      .from('org_membros')
      .select('*, organizacoes(id, nome, cnpj, plano, created_at, updated_at)')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .single()

    orgMembro = membro

    if (membro?.org_id) {
      organizacao = membro.organizacoes

      // Get all org members (only if user is admin/manager)
      if (membro.role === 'admin' || membro.role === 'manager') {
        const { data: membros } = await supabase
          .from('org_membros')
          .select('*, profiles(nome, email)')
          .eq('org_id', membro.org_id)
          .order('created_at')

        orgMembros = membros ?? []
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
