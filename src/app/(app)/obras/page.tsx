import { createClient } from '@/lib/supabase/server'
import { ObrasContent } from '@/components/obras/obras-content'

export const dynamic = 'force-dynamic'

export default async function ObrasPage() {
  const supabase = await createClient()
  const { data: obras } = await supabase
    .from('obras')
    .select('*')
    .order('created_at', { ascending: false })

  return <ObrasContent initialObras={obras ?? []} />
}
