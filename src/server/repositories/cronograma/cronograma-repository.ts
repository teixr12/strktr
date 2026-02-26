import type { SupabaseClient } from '@supabase/supabase-js'

export async function ensureCronogramaForObra(
  supabase: SupabaseClient,
  input: { obraId: string; orgId: string; userId: string }
) {
  const existing = await supabase
    .from('cronograma_obras')
    .select('id')
    .eq('obra_id', input.obraId)
    .eq('org_id', input.orgId)
    .maybeSingle()

  if (existing.error) {
    return { data: null, error: existing.error }
  }
  if (existing.data?.id) {
    return { data: existing.data, error: null }
  }

  const created = await supabase
    .from('cronograma_obras')
    .insert({
      obra_id: input.obraId,
      org_id: input.orgId,
      user_id: input.userId,
      nome: 'Cronograma principal',
    })
    .select('id')
    .single()

  return created
}
