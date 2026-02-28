import { createClient } from '@/lib/supabase/server'
import { ComprasContent } from '@/components/compras/compras-content'

export const dynamic = 'force-dynamic'

export default async function ComprasPage() {
  const supabase = await createClient()

  const [comprasRes, obrasRes] = await Promise.all([
    supabase
      .from('compras')
      .select('*, obras(nome)')
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase.from('obras').select('id, nome'),
  ])

  return (
    <ComprasContent
      initialCompras={comprasRes.data ?? []}
      obras={obrasRes.data ?? []}
    />
  )
}
