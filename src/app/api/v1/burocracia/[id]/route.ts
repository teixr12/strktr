import type { SupabaseClient } from '@supabase/supabase-js'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { withBureaucracyAuth } from '@/lib/bureaucracy/api'
import { updateBureaucracyItemSchema } from '@/shared/schemas/bureaucracy'
import type { BureaucracyRecord } from '@/shared/types/bureaucracy'

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

async function hydrateContext(
  supabase: SupabaseClient,
  row: BureaucracyRow
): Promise<BureaucracyRecord> {
  const [obraRes, projetoRes] = await Promise.all([
    row.obra_id
      ? supabase.from('obras').select('id, nome').eq('id', row.obra_id).maybeSingle()
      : Promise.resolve({ data: null as ContextRow | null, error: null }),
    row.projeto_id
      ? supabase.from('projetos').select('id, nome').eq('id', row.projeto_id).maybeSingle()
      : Promise.resolve({ data: null as ContextRow | null, error: null }),
  ])

  if (obraRes.error || projetoRes.error) {
    throw new Error(obraRes.error?.message || projetoRes.error?.message || 'Falha ao carregar contexto')
  }

  return {
    ...row,
    obra_nome: obraRes.data?.nome || null,
    projeto_nome: projetoRes.data?.nome || null,
  }
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
  const id = new URL(request.url).pathname.split('/').pop() || ''

  const { data, error } = await supabase
    .from('burocracia_itens')
    .select(BUREAUCRACY_COLUMNS)
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (error) {
    log('error', 'burocracia.get_by_id.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  if (!data) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item não encontrado' }, 404)
  }

  try {
    const hydrated = await hydrateContext(supabase, (data as unknown) as BureaucracyRow)
    return ok(request, hydrated)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const PUT = withBureaucracyAuth('can_manage_projects', async (request, { supabase, requestId, orgId, user }) => {
  const id = new URL(request.url).pathname.split('/').pop() || ''
  const parsed = updateBureaucracyItemSchema.safeParse(await request.json().catch(() => null))

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

  const { data: existing, error: existingError } = await supabase
    .from('burocracia_itens')
    .select('id, obra_id, projeto_id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (existingError) {
    log('error', 'burocracia.lookup.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia/[id]',
      itemId: id,
      error: existingError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: existingError.message }, 500)
  }

  if (!existing) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Item não encontrado' }, 404)
  }

  const candidate = {
    obra_id: parsed.data.obra_id !== undefined ? parsed.data.obra_id || null : existing.obra_id,
    projeto_id: parsed.data.projeto_id !== undefined ? parsed.data.projeto_id || null : existing.projeto_id,
  }

  try {
    await ensureLinkedContext(supabase, orgId, candidate)
  } catch (err) {
    const status = err instanceof Error && 'status' in err ? Number((err as { status?: number }).status || 500) : 500
    const code = err instanceof Error && 'code' in err ? String((err as { code?: string }).code || API_ERROR_CODES.DB_ERROR) : API_ERROR_CODES.DB_ERROR
    return fail(request, { code, message: err instanceof Error ? err.message : 'Falha ao validar contexto' }, status)
  }

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: nowIso,
    ultima_atualizacao_em: nowIso,
  }

  const keys: Array<keyof typeof parsed.data> = [
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
  ]

  for (const key of keys) {
    if (parsed.data[key] !== undefined) {
      updates[key] = parsed.data[key] || null
    }
  }

  const { data, error } = await supabase
    .from('burocracia_itens')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select(BUREAUCRACY_COLUMNS)
    .single()

  if (error) {
    log('error', 'burocracia.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  try {
    const hydrated = await hydrateContext(supabase, (data as unknown) as BureaucracyRow)
    return ok(request, hydrated)
  } catch (err) {
    return fail(
      request,
      { code: API_ERROR_CODES.DB_ERROR, message: err instanceof Error ? err.message : 'Falha ao carregar contexto' },
      500
    )
  }
})

export const DELETE = withBureaucracyAuth('can_manage_projects', async (request, { supabase, requestId, orgId, user }) => {
  const id = new URL(request.url).pathname.split('/').pop() || ''

  const { error } = await supabase
    .from('burocracia_itens')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    log('error', 'burocracia.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/burocracia/[id]',
      itemId: id,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, { success: true })
})
