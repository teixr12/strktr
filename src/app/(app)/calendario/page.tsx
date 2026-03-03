import { createClient } from '@/lib/supabase/server'
import { CalendarioContent } from '@/components/calendario/calendario-content'
import type { Visita } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: visitas } = await supabase
    .from('visitas')
    .select('id,user_id,org_id,obra_id,lead_id,titulo,descricao,tipo,data_hora,duracao_min,local,status,participantes,notas,created_at,obras(nome),leads(nome)')
    .order('data_hora', { ascending: true })

  return <CalendarioContent initialVisitas={(visitas ?? []) as unknown as Visita[]} />
}
