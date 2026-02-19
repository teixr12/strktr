import { createClient } from '@/lib/supabase/server'
import { CalendarioContent } from '@/components/calendario/calendario-content'

export default async function CalendarioPage() {
  const supabase = await createClient()
  const { data: visitas } = await supabase
    .from('visitas')
    .select('*, obras(nome), leads(nome)')
    .order('data_hora', { ascending: true })

  return <CalendarioContent initialVisitas={visitas ?? []} />
}
