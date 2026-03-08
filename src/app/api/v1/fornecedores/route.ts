import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { withSupplierManagementAuth } from '@/lib/supplier-management/api'
import { createSupplierSchema } from '@/shared/schemas/supplier-management'
import type { SupplierRecord, SupplierSummary } from '@/shared/types/supplier-management'

const SUPPLIER_COLUMNS =
  'id, org_id, nome, documento, email, telefone, cidade, estado, status, score_manual, notas, created_at, updated_at'

function normalizeSearchTerm(value: string | null): string | null {
  const normalized = (value || '').trim().replace(/[%_,]/g, '')
  return normalized.length > 0 ? normalized : null
}

function buildSummary(items: Array<Pick<SupplierRecord, 'status' | 'score_manual'>>): SupplierSummary {
  if (items.length === 0) {
    return {
      total: 0,
      active: 0,
      watchlist: 0,
      blocked: 0,
      averageScore: 0,
    }
  }

  const active = items.filter((item) => item.status === 'active').length
  const watchlist = items.filter((item) => item.status === 'watchlist').length
  const blocked = items.filter((item) => item.status === 'blocked').length
  const averageScore = items.reduce((sum, item) => sum + Number(item.score_manual || 0), 0) / items.length

  return {
    total: items.length,
    active,
    watchlist,
    blocked,
    averageScore: Number(averageScore.toFixed(1)),
  }
}

export const GET = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') || '').trim()
  const search = normalizeSearchTerm(searchParams.get('q'))
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  let query = supabase
    .from('fornecedores')
    .select(SUPPLIER_COLUMNS, { count: 'exact' })
    .eq('org_id', orgId)

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`nome.ilike.%${search}%,documento.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, count, error } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) {
    log('error', 'fornecedores.get.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  const { data: summaryRows, error: summaryError } = await supabase
    .from('fornecedores')
    .select('status, score_manual')
    .eq('org_id', orgId)

  if (summaryError) {
    log('error', 'fornecedores.summary.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores',
      error: summaryError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: summaryError.message }, 500)
  }

  const total = count ?? data?.length ?? 0

  return ok(
    request,
    (data as SupplierRecord[] | null) ?? [],
    {
      ...buildPaginationMeta(data?.length || 0, total, page, pageSize),
      summary: buildSummary((summaryRows as Array<Pick<SupplierRecord, 'status' | 'score_manual'>>) || []),
    }
  )
})

export const POST = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createSupplierSchema.safeParse(await request.json().catch(() => null))
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

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({
      org_id: orgId,
      nome: parsed.data.nome,
      documento: parsed.data.documento || null,
      email: parsed.data.email || null,
      telefone: parsed.data.telefone || null,
      cidade: parsed.data.cidade || null,
      estado: parsed.data.estado || null,
      status: parsed.data.status,
      score_manual: parsed.data.score_manual,
      notas: parsed.data.notas || null,
      created_by: user.id,
      updated_by: user.id,
      updated_at: nowIso,
    })
    .select(SUPPLIER_COLUMNS)
    .single()

  if (error) {
    log('error', 'fornecedores.create.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores',
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, data as SupplierRecord, undefined, 201)
})
