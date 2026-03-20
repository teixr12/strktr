import type { SupabaseClient } from '@supabase/supabase-js'
import { getBureaucracyTodayKey, isBureaucracyDateOverdue } from '@/lib/bureaucracy/date'
import type { BureaucracyRecord, BureaucracyStatus } from '@/shared/types/bureaucracy'
import type { SupplierIntelligenceMetrics, SupplierIntelligencePayload } from '@/shared/types/supplier-intelligence'
import type { SupplierRecord } from '@/shared/types/supplier-management'

const SUPPLIER_COLUMNS =
  'id, org_id, nome, documento, email, telefone, cidade, estado, status, score_manual, notas, created_at, updated_at'

const BUREAUCRACY_COLUMNS = [
  'id',
  'org_id',
  'titulo',
  'categoria',
  'status',
  'prioridade',
  'obra_id',
  'projeto_id',
  'supplier_id',
  'processo_codigo',
  'orgao_nome',
  'responsavel_nome',
  'responsavel_email',
  'proxima_acao',
  'proxima_checagem_em',
  'reuniao_em',
  'link_externo',
  'descricao',
  'created_at',
  'updated_at',
  'ultima_atualizacao_em',
].join(', ')

type BureaucracyRow = Omit<BureaucracyRecord, 'obra_nome' | 'projeto_nome'>
type ContextRow = { id: string; nome: string | null }

function getStatusWeight(status: BureaucracyStatus): number {
  switch (status) {
    case 'draft':
      return 5
    case 'pending':
      return 10
    case 'scheduled':
      return 10
    case 'in_review':
      return 15
    case 'waiting_external':
      return 20
    default:
      return 0
  }
}

function isOpenStatus(status: BureaucracyStatus): boolean {
  return getStatusWeight(status) > 0
}

async function hydrateContext(
  supabase: SupabaseClient,
  rows: BureaucracyRow[]
): Promise<BureaucracyRecord[]> {
  const obraIds = Array.from(new Set(rows.map((row) => row.obra_id).filter(Boolean))) as string[]
  const projetoIds = Array.from(new Set(rows.map((row) => row.projeto_id).filter(Boolean))) as string[]

  const [obrasRes, projetosRes] = await Promise.all([
    obraIds.length > 0
      ? supabase.from('obras').select('id, nome').in('id', obraIds)
      : Promise.resolve({ data: [] as ContextRow[], error: null }),
    projetoIds.length > 0
      ? supabase.from('projetos').select('id, nome').in('id', projetoIds)
      : Promise.resolve({ data: [] as ContextRow[], error: null }),
  ])

  if (obrasRes.error || projetosRes.error) {
    throw new Error(obrasRes.error?.message || projetosRes.error?.message || 'Falha ao carregar contexto')
  }

  const obraNames = new Map(((obrasRes.data || []) as ContextRow[]).map((item) => [item.id, item.nome || 'Obra']))
  const projetoNames = new Map(((projetosRes.data || []) as ContextRow[]).map((item) => [item.id, item.nome || 'Projeto']))

  return rows.map((row) => ({
    ...row,
    obra_nome: row.obra_id ? obraNames.get(row.obra_id) || null : null,
    projeto_nome: row.projeto_id ? projetoNames.get(row.projeto_id) || null : null,
  }))
}

function buildMetrics(items: BureaucracyRecord[], today = getBureaucracyTodayKey()): SupplierIntelligenceMetrics {
  const openItems = items.filter((item) => isOpenStatus(item.status))
  const overdueCount = openItems.filter((item) => isBureaucracyDateOverdue(item.proxima_checagem_em, today)).length
  const datedOpenItems = openItems
    .map((item) => item.proxima_checagem_em)
    .filter((value): value is string => Boolean(value))
    .sort()

  const baseScore = openItems.reduce((sum, item) => sum + getStatusWeight(item.status), 0)
  const supplierRiskScore = Math.min(100, baseScore + overdueCount * 15)
  const thresholdReached = overdueCount >= 3

  return {
    supplier_risk_score: supplierRiskScore,
    overdue_count: overdueCount,
    next_deadline: datedOpenItems[0] || null,
    linked_items_total: items.length,
    open_items_total: openItems.length,
    risk_state: thresholdReached ? 'at_risk' : 'clear',
    threshold_reached: thresholdReached,
  }
}

export async function fetchSupplierIntelligence(
  supabase: SupabaseClient,
  orgId: string,
  supplierId: string
): Promise<SupplierIntelligencePayload | null> {
  const { data: supplier, error: supplierError } = await supabase
    .from('fornecedores')
    .select(SUPPLIER_COLUMNS)
    .eq('id', supplierId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (supplierError) {
    throw new Error(supplierError.message)
  }

  if (!supplier) {
    return null
  }

  const { data: rawItems, error: itemsError } = await supabase
    .from('burocracia_itens')
    .select(BUREAUCRACY_COLUMNS)
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .order('updated_at', { ascending: false })

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  const linkedItems = await hydrateContext(supabase, ((rawItems || []) as unknown) as BureaucracyRow[])

  return {
    supplier: supplier as SupplierRecord,
    linkedBureaucracyItems: linkedItems,
    metrics: buildMetrics(linkedItems),
    generatedAt: new Date().toISOString(),
  }
}
