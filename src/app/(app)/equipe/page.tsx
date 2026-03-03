import { createClient } from '@/lib/supabase/server'
import { EquipeContent } from '@/components/equipe/equipe-content'
import type { Membro } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: membros } = await supabase
    .from('equipe')
    .select('id,user_id,org_id,nome,cargo,telefone,email,especialidade,status,obras_ids,avaliacao,valor_hora,notas,avatar_url,created_at')
    .order('nome')

  return <EquipeContent initialMembros={(membros ?? []) as unknown as Membro[]} />
}
