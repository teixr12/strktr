import { createClient } from '@/lib/supabase/server'
import { EquipeContent } from '@/components/equipe/equipe-content'

export default async function EquipePage() {
  const supabase = await createClient()
  const { data: membros } = await supabase
    .from('equipe')
    .select('*')
    .order('nome')

  return <EquipeContent initialMembros={membros ?? []} />
}
