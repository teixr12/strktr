import type { SupabaseClient } from '@supabase/supabase-js'
import { log } from '@/lib/api/logger'
import { getBureaucracyTodayKey, isBureaucracyDateOverdue } from '@/lib/bureaucracy/date'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { BureaucracyRecord, BureaucracyStatus } from '@/shared/types/bureaucracy'
import type {
  SupplierIntelligenceMetrics,
  SupplierIntelligencePayload,
  SupplierRiskState,
} from '@/shared/types/supplier-intelligence'
import type { SupplierRecord } from '@/shared/types/supplier-management'

const SUPPLIER_COLUMNS =
  'id, org_id, nome, documento, email, telefone, cidade, estado, status, score_manual, notas, created_at, updated_at'
const SUPPLIER_SELECT = `${SUPPLIER_COLUMNS}, supplier_intelligence`

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

const BUREAUCRACY_SELECT = `${BUREAUCRACY_COLUMNS}, obras(nome), projetos(nome)`

type BureaucracyRow = Omit<BureaucracyRecord, 'obra_nome' | 'projeto_nome'>
type EmbeddedContextRow = { nome: string | null }
type EmbeddedContextValue = EmbeddedContextRow | EmbeddedContextRow[] | null
type EmbeddedBureaucracyRow = BureaucracyRow & {
  obras?: EmbeddedContextValue
  projetos?: EmbeddedContextValue
}
type SupplierRowWithIntelligence = SupplierRecord & {
  supplier_intelligence?: unknown
}

export type SupplierRiskMetricItem = Pick<BureaucracyRecord, 'status' | 'proxima_checagem_em'>
export type SupplierIntelligenceBody = Omit<SupplierIntelligencePayload, 'generatedAt'>
export type StoredSupplierIntelligenceSnapshot = Pick<
  SupplierIntelligenceBody,
  'linkedBureaucracyItems' | 'metrics'
>

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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractEmbeddedName(value: EmbeddedContextValue | undefined, fallbackLabel: string): string | null {
  if (!value) {
    return null
  }

  const relation = Array.isArray(value) ? value[0] : value
  if (!relation) {
    return null
  }

  return relation.nome || fallbackLabel
}

function normalizeBureaucracyRow(row: EmbeddedBureaucracyRow): BureaucracyRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    titulo: row.titulo,
    categoria: row.categoria,
    status: row.status,
    prioridade: row.prioridade,
    obra_id: row.obra_id,
    obra_nome: row.obra_id ? extractEmbeddedName(row.obras, 'Obra') : null,
    projeto_id: row.projeto_id,
    projeto_nome: row.projeto_id ? extractEmbeddedName(row.projetos, 'Projeto') : null,
    supplier_id: row.supplier_id,
    processo_codigo: row.processo_codigo,
    orgao_nome: row.orgao_nome,
    responsavel_nome: row.responsavel_nome,
    responsavel_email: row.responsavel_email,
    proxima_acao: row.proxima_acao,
    proxima_checagem_em: row.proxima_checagem_em,
    reuniao_em: row.reuniao_em,
    link_externo: row.link_externo,
    descricao: row.descricao,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ultima_atualizacao_em: row.ultima_atualizacao_em,
  }
}

function toSupplierRecord(row: SupplierRowWithIntelligence): SupplierRecord {
  const { supplier_intelligence: _supplierIntelligence, ...supplier } = row
  return supplier
}

function isStoredSupplierRiskState(value: unknown): value is SupplierRiskState {
  return value === 'clear' || value === 'at_risk'
}

function isStoredSupplierIntelligenceSnapshot(value: unknown): value is StoredSupplierIntelligenceSnapshot {
  if (!isObjectRecord(value) || !Array.isArray(value.linkedBureaucracyItems) || !isObjectRecord(value.metrics)) {
    return false
  }

  const metrics = value.metrics
  return (
    typeof metrics.supplier_risk_score === 'number' &&
    typeof metrics.overdue_count === 'number' &&
    (metrics.next_deadline === null || typeof metrics.next_deadline === 'string') &&
    typeof metrics.linked_items_total === 'number' &&
    typeof metrics.open_items_total === 'number' &&
    isStoredSupplierRiskState(metrics.risk_state) &&
    typeof metrics.threshold_reached === 'boolean'
  )
}

export function computeSupplierRiskMetrics(
  items: SupplierRiskMetricItem[],
  today = getBureaucracyTodayKey()
): SupplierIntelligenceMetrics {
  let openItemsTotal = 0
  let overdueCount = 0
  let nextDeadline: string | null = null
  let baseScore = 0

  for (const item of items) {
    if (!isOpenStatus(item.status)) {
      continue
    }

    openItemsTotal += 1
    baseScore += getStatusWeight(item.status)

    if (item.proxima_checagem_em && (!nextDeadline || item.proxima_checagem_em < nextDeadline)) {
      nextDeadline = item.proxima_checagem_em
    }

    if (isBureaucracyDateOverdue(item.proxima_checagem_em, today)) {
      overdueCount += 1
    }
  }

  const supplierRiskScore = Math.min(100, baseScore + overdueCount * 15)
  const thresholdReached = overdueCount >= 3

  return {
    supplier_risk_score: supplierRiskScore,
    overdue_count: overdueCount,
    next_deadline: nextDeadline,
    linked_items_total: items.length,
    open_items_total: openItemsTotal,
    risk_state: thresholdReached ? 'at_risk' : 'clear',
    threshold_reached: thresholdReached,
  }
}

function buildServiceRequestId(): string {
  return `supplier-intelligence:${crypto.randomUUID()}`
}

export function buildSupplierIntelligenceBody(
  supplier: SupplierRecord,
  linkedBureaucracyItems: BureaucracyRecord[]
): SupplierIntelligenceBody {
  return {
    supplier,
    linkedBureaucracyItems,
    metrics: computeSupplierRiskMetrics(linkedBureaucracyItems),
  }
}

export function buildStoredSupplierIntelligenceSnapshot(
  body: Pick<SupplierIntelligenceBody, 'linkedBureaucracyItems' | 'metrics'>
): StoredSupplierIntelligenceSnapshot {
  return {
    linkedBureaucracyItems: body.linkedBureaucracyItems,
    metrics: body.metrics,
  }
}

function buildSupplierIntelligencePayload(body: SupplierIntelligenceBody): SupplierIntelligencePayload {
  return {
    ...body,
    generatedAt: new Date().toISOString(),
  }
}

async function loadSupplierRow(
  db: SupabaseClient,
  orgId: string,
  supplierId: string
): Promise<SupplierRowWithIntelligence | null> {
  const { data, error } = await db
    .from('fornecedores')
    .select(SUPPLIER_SELECT)
    .eq('id', supplierId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? ((data as unknown) as SupplierRowWithIntelligence) : null
}

export async function loadLinkedBureaucracyItems(
  db: SupabaseClient,
  orgId: string,
  supplierId: string
): Promise<BureaucracyRecord[]> {
  const { data, error } = await db
    .from('burocracia_itens')
    .select(BUREAUCRACY_SELECT)
    .eq('org_id', orgId)
    .eq('supplier_id', supplierId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (((data || []) as unknown) as EmbeddedBureaucracyRow[]).map(normalizeBureaucracyRow)
}

export async function loadLiveSupplierIntelligenceBody(
  db: SupabaseClient,
  orgId: string,
  supplierId: string
): Promise<SupplierIntelligenceBody | null> {
  const [supplierRes, linkedBureaucracyItems] = await Promise.all([
    db.from('fornecedores').select(SUPPLIER_COLUMNS).eq('id', supplierId).eq('org_id', orgId).maybeSingle(),
    loadLinkedBureaucracyItems(db, orgId, supplierId),
  ])

  const { data: supplier, error: supplierError } = supplierRes
  if (supplierError) {
    throw new Error(supplierError.message)
  }

  if (!supplier) {
    return null
  }

  return buildSupplierIntelligenceBody((supplier as unknown) as SupplierRecord, linkedBureaucracyItems)
}

export async function fetchSupplierIntelligence(
  supabase: SupabaseClient,
  orgId: string,
  supplierId: string
): Promise<SupplierIntelligencePayload | null> {
  const requestId = buildServiceRequestId()
  const serviceRoleClient = createServiceRoleClient()
  const db = serviceRoleClient ?? supabase

  if (!serviceRoleClient) {
    log('warn', 'supplier-intelligence.fallback-to-user-client', {
      requestId,
      orgId,
      supplierId,
    })

    if (process.env.NODE_ENV === 'production') {
      log('error', 'supplier-intelligence.service-role-missing', {
        requestId,
        orgId,
        supplierId,
      })
    }
  }

  const supplierRow = await loadSupplierRow(db, orgId, supplierId)
  if (!supplierRow) {
    return null
  }

  const supplier = toSupplierRecord(supplierRow)
  if (isStoredSupplierIntelligenceSnapshot(supplierRow.supplier_intelligence)) {
    return buildSupplierIntelligencePayload({
      supplier,
      ...supplierRow.supplier_intelligence,
    })
  }

  const linkedBureaucracyItems = await loadLinkedBureaucracyItems(db, orgId, supplierId)
  return buildSupplierIntelligencePayload(buildSupplierIntelligenceBody(supplier, linkedBureaucracyItems))
}
