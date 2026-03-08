import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortalAdminObraApprovalItem,
  PortalAdminObraCommentItem,
  PortalAdminObraOverviewPayload,
} from '@/shared/types/portal-admin'

type ApprovalRow = PortalAdminObraApprovalItem
type CommentRow = PortalAdminObraCommentItem

export async function getPortalAdminObraOverview({
  supabase,
  orgId,
  obraId,
}: {
  supabase: SupabaseClient
  orgId: string
  obraId: string
}): Promise<PortalAdminObraOverviewPayload> {
  const [
    pendingApprovalsRes,
    overduePendingApprovalsRes,
    approvedApprovalsRes,
    rejectedApprovalsRes,
    approvalsRes,
    nextPendingApprovalRes,
    commentsCountRes,
    clientCommentsCountRes,
    commentsRes,
  ] = await Promise.all([
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('status', 'pendente'),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('status', 'pendente')
      .not('sla_due_at', 'is', null)
      .lt('sla_due_at', new Date().toISOString()),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('status', 'aprovado'),
    supabase
      .from('aprovacoes_cliente')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('status', 'rejeitado'),
    supabase
      .from('aprovacoes_cliente')
      .select('id, tipo, status, solicitado_em, sla_due_at, decisao_comentario')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .order('solicitado_em', { ascending: false })
      .limit(5),
    supabase
      .from('aprovacoes_cliente')
      .select('id, sla_due_at')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('status', 'pendente')
      .not('sla_due_at', 'is', null)
      .order('sla_due_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('portal_comentarios')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId),
    supabase
      .from('portal_comentarios')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .eq('origem', 'cliente'),
    supabase
      .from('portal_comentarios')
      .select('id, origem, mensagem, created_at')
      .eq('org_id', orgId)
      .eq('obra_id', obraId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const firstError =
    pendingApprovalsRes.error ||
    overduePendingApprovalsRes.error ||
    approvedApprovalsRes.error ||
    rejectedApprovalsRes.error ||
    approvalsRes.error ||
    nextPendingApprovalRes.error ||
    commentsCountRes.error ||
    clientCommentsCountRes.error ||
    commentsRes.error

  if (firstError) {
    throw new Error(firstError.message)
  }

  const recentApprovals = ((approvalsRes.data || []) as unknown) as ApprovalRow[]
  const recentComments = ((commentsRes.data || []) as unknown) as CommentRow[]
  const totalComments = commentsCountRes.count || 0
  const clientComments = clientCommentsCountRes.count || 0

  return {
    summary: {
      pendingApprovals: pendingApprovalsRes.count || 0,
      overduePendingApprovals: overduePendingApprovalsRes.count || 0,
      approvedApprovals: approvedApprovalsRes.count || 0,
      rejectedApprovals: rejectedApprovalsRes.count || 0,
      totalComments,
      clientComments,
      internalComments: Math.max(0, totalComments - clientComments),
      latestApprovalAt: recentApprovals[0]?.solicitado_em || null,
      latestCommentAt: recentComments[0]?.created_at || null,
      nextPendingSlaAt: nextPendingApprovalRes.data?.sla_due_at || null,
    },
    recentApprovals,
    recentComments,
  }
}
