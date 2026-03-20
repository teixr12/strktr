import type { SupabaseClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { fail, ok } from '@/lib/api/response'
import { withBureaucracyAuth } from '@/lib/bureaucracy/api'
import { createBureaucracyItemSchema } from '@/shared/schemas/bureaucracy'
import type { BureaucracyRecord, BureaucracySummary } from '@/shared/types/bureaucracy'

const BUREAUCRACY_COLUMNS = [
  'id',
  'org_id',
  'titulo',
  'categoria',
  'status',
  'prioridade',
  'obra_id',
  'projeto_id',
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

function normalizeSearchTerm(value: string | null): string | null {
  const normalized = (value || '').trim().replace(/[%_,]/g, '')
  return normalized.length > 0 ? normalized : null
}

function isOpenStatus(status: BureaucracyRecord['status']) {
  return status !== 'resolved' && status !== 'archived'
}

function buildSummary(rows: Array<Pick<BureaucracyRecord, 'status' | 'prioridade' | 'proxima_checagem_em'>>): BureaucracySummary {
  const today = new Date().toISOString().slice(0, 10)
  const open = rows.filter((row) => isOpenStatus(row.status)).length
  const urgent = rows.filter((row) => row.prioridade === 'critical' || row.prioridade === 'high').length
  const overdue = rows.filter(
    (row) => Boolean(row.proxima_checagem_em) && row.proxima_checagem_em! < today && isOpenStatus(row.status)
  ).length
  const waitingExternal = rows.filter((row) => row.status === 'waiting_external').length
  const resolved = rows.filter((row) => row.status === 'resolved').length

  return {
    total: rows.length,
    open,
    urgent,
    overdue,
    waitingExternal,
    resolved,
  }
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

async function ensureLinkedContext(
  supabase: SupabaseClient,
  orgId: string,
  payload: { obra_id?: string | null; projeto_id?: string | null }
) {
  if (payload.obra_id) {
    const { data, error } = await supabase
      .from('obras')
      .select('id')
      .eq('id', payload.obra_id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      const err = new Error('Obra vinculada não encontrada') as Error & { code?: string; status?: number }
      err.code = API_ERROR_CODES.NOT_FOUND
      err.status = 404
      throw err
    }
  }

  if (payload.projeto_id) {
    const { data, error } = await supabase
      .from('projetos')
      .select('id')
      .eq('id', payload.projeto_id)
      .eq('org_id', orgId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      const err = new Error('Projeto vinculado não encontrado') as Error & { code?: string; status?: number }
      err.code = API_ERROR_CODES.NOT_FOUND
      err.status = 404
      throw err
    }
  }
}

export const GET = withBureaucracyAuth('can_manage_projects', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || '').trim()
  const categoria = (searchParams.get('categoria') || '').trim()
  const prioridade = (searchParams.get('prioridade') || '').trim()
  const search = normalizeSearchTerm(searchParams.get('q'))
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('burocracia_itens')
    .select(BUREAUCRACY_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)

  if (status) query = query.eq('status', status)
  if (categoria) query = query.eq('categoria', categoria)
  if (prioridade) query = query.eq('prioridade', prioridade)
  if (search) {
    query = query.or(
      `titulo.ilike.%${search}%,processo_codigo.ilike.%${search}%,orgao_nome.ilike.%${search}%,responsavel_nome.ilike.%${search}%`
    )
  }

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    log('error', 'burocracia.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('burocracia_itens')
    .select('status, prioridade, proxima_checagem_em')
    .eq('org_id', orgId)

  if (summaryError) {
    log('error', 'burocracia.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia',
      error: summaryError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: summaryError.message }, 500)
  }

  try {
    const normalized = await hydrateContext(supabase, ((data || []) as unknown) as BureaucracyRow[])
    const total = count ?? normalized.length
    return ok(request, normalized, {
      ...buildPaginationMeta(normalized.length, total, page, pageSize),
      summary: buildSummary(((summaryRows || []) as unknown) as Array<Pick<BureaucracyRecord, 'status' | 'prioridade' | 'proxima_checagem_em'>>),
    })
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const POST = withBureaucracyAuth('can_manage_projects', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createBureaucracyItemSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return fail(
      request,
      {
        code: API_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message || 'Payload inválido',
      },
      400
    )
  }

  try {
    await ensureLinkedContext(supabase, orgId, parsed.data)
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? Number((err as { status?: number }).status || 500) : 500
    const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || API_ERROR_CODES.DB_ERROR) : API_ERROR_CODES.DB_ERROR
    return fail(request, { code, message: err instanceof Error ? err.message : 'Falha ao validar contexto' }, status)
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('burocracia_itens')
    .insert({
      org_id: orgId,
      titulo: parsed.data.titulo,
      categoria: parsed.data.categoria,
      status: parsed.data.status,
      prioridade: parsed.data.prioridade,
      obra_id: parsed.data.obra_id || null,
      projeto_id: parsed.data.projeto_id || null,
      processo_codigo: parsed.data.processo_codigo || null,
      orgao_nome: parsed.data.orgao_nome || null,
      responsavel_nome: parsed.data.responsavel_nome || null,
      responsavel_email: parsed.data.responsavel_email || null,
      proxima_acao: parsed.data.proxima_acao || null,
      proxima_checagem_em: parsed.data.proxima_checagem_em || null,
      reuniao_em: parsed.data.reuniao_em || null,
      link_externo: parsed.data.link_externo || null,
      descricao: parsed.data.descricao || null,
      ultima_atualizacao_em: nowIso,
      created_by: user.id,
      updated_by: user.id,
      updated_at: nowIso,
    })
    .select(BUREAUCRACY_COLUMNS)
    .single()

  if (error) {
    log('error', 'burocracia.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  try {
    const [record] = await hydrateContext(supabase, [((data as unknown) as BureaucracyRow)])
    return ok(request, record, undefined, 201)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})
