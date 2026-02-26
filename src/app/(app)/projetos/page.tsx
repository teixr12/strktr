import { createClient } from '@/lib/supabase/server'
import { ProjetosContent } from '@/components/projetos/projetos-content'

export const dynamic = 'force-dynamic'

export default async function ProjetosPage() {
  const supabase = await createClient()

  const [projetosRes, leadsRes] = await Promise.all([
    supabase.from('projetos').select('*, leads(nome), obras(nome)').order('created_at', { ascending: false }),
    supabase.from('leads').select('id, nome'),
  ])

  return (
    <ProjetosContent
      initialProjetos={projetosRes.data ?? []}
      leads={leadsRes.data ?? []}
    />
  )
}
