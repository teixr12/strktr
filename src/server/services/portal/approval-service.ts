import type { SupabaseClient } from '@supabase/supabase-js'

type EnsureApprovalInput = {
  supabase: SupabaseClient
  orgId: string
  obraId: string
  userId: string
  tipo: 'compra' | 'orcamento'
  approvalVersion?: number
  predecessorApprovalId?: string | null
  forceNew?: boolean
  compraId?: string | null
  orcamentoId?: string | null
}

export async function ensurePendingApproval(input: EnsureApprovalInput) {
  const {
    supabase,
    orgId,
    obraId,
    userId,
    tipo,
    approvalVersion = 1,
    predecessorApprovalId = null,
    forceNew = false,
    compraId,
    orcamentoId,
  } = input

  if (!forceNew) {
    let query = supabase
      .from('aprovacoes_cliente')
      .select('id, status, approval_version')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('tipo', tipo)
      .eq('status', 'pendente')
      .eq('approval_version', approvalVersion)

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
      approval_version: approvalVersion,
      predecessor_aprovacao_id: predecessorApprovalId,
      solicitado_por: userId,
    })
    .select('id, status, approval_version')
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
    .select('status, approval_version, sla_due_at')
    .eq('id', approvalId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) return { status: null, error }
  return {
    status: data?.status || null,
    approvalVersion: data?.approval_version || null,
    slaDueAt: data?.sla_due_at || null,
    error: null,
  }
}
