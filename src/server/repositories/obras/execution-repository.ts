import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchObraByOrg(
  supabase: SupabaseClient,
  obraId: string,
  orgId: string
) {
  const { data, error } = await supabase
    .from('obras')
    .select('*')
    .eq('id', obraId)
    .eq('org_id', orgId)
    .single()

  return { data, error }
}

export async function fetchExecutionContext(
  supabase: SupabaseClient,
  obraId: string,
  orgId: string
) {
  const [obraRes, etapasRes, checklistsRes, txRes, diarioRes] = await Promise.all([
    fetchObraByOrg(supabase, obraId, orgId),
    supabase.from('obra_etapas').select('*').eq('obra_id', obraId).order('ordem'),
    supabase
      .from('obra_checklists')
      .select('id, nome, checklist_items(id, concluido, data_limite)')
      .eq('obra_id', obraId)
      .order('ordem'),
    supabase
      .from('transacoes')
      .select('tipo, valor')
      .eq('obra_id', obraId)
      .eq('org_id', orgId),
    supabase
      .from('diario_obra')
      .select('created_at')
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    obraRes,
    etapasRes,
    checklistsRes,
    txRes,
    diarioRes,
  }
}
