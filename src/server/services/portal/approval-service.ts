import type { SupabaseClient } from '@supabase/supabase-js'

type EnsureApprovalInput = {
  supabase: SupabaseClient
  orgId: string
  obraId: string
  userId: string
  tipo: 'compra' | 'orcamento'
  compraId?: string | null
  orcamentoId?: string | null
}

export async function ensurePendingApproval(input: EnsureApprovalInput) {
  const { supabase, orgId, obraId, userId, tipo, compraId, orcamentoId } = input

  let query = supabase
    .from('aprovacoes_cliente')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('obra_id', obraId)
    .eq('tipo', tipo)
    .eq('status', 'pendente')

  if (tipo === 'compra') {
    query = query.eq('compra_id', compraId)
  } else {
    query = query.eq('orcamento_id', orcamentoId)
  }

  const existing = await query.maybeSingle()
  if (existing.error) {
    return { data: null, error: existing.error }
  }
  if (existing.data?.id) {
    return { data: existing.data, error: null }
  }

  const created = await supabase
    .from('aprovacoes_cliente')
    .insert({
      org_id: orgId,
      obra_id: obraId,
      tipo,
      compra_id: tipo === 'compra' ? compraId || null : null,
      orcamento_id: tipo === 'orcamento' ? orcamentoId || null : null,
      status: 'pendente',
      solicitado_por: userId,
    })
    .select('id, status')
    .single()

  return created
}

export async function getApprovalStatus(
  supabase: SupabaseClient,
  orgId: string,
  approvalId: string | null | undefined
) {
  if (!approvalId) return { status: null, error: null }

  const { data, error } = await supabase
    .from('aprovacoes_cliente')
    .select('status')
    .eq('id', approvalId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) return { status: null, error }
  return { status: data?.status || null, error: null }
}
