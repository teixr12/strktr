import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { withSupplierManagementAuth } from '@/lib/supplier-management/api'
import { updateSupplierSchema } from '@/shared/schemas/supplier-management'
import type { SupplierRecord } from '@/shared/types/supplier-management'

const SUPPLIER_COLUMNS =
  'id, org_id, nome, documento, email, telefone, cidade, estado, status, score_manual, notas, created_at, updated_at'

export const GET = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const supplierId = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)
  if (!supplierId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Fornecedor inválido' }, 400)
  }

  const { data, error } = await supabase
    .from('fornecedores')
    .select(SUPPLIER_COLUMNS)
    .eq('id', supplierId)
    .eq('org_id', orgId)
    .single()

  if (error || !data) {
    log('warn', 'fornecedores.get_by_id.not_found', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores/[id]',
      supplierId,
    })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Fornecedor não encontrado' }, 404)
  }

  return ok(request, data as SupplierRecord)
})

export const PATCH = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const supplierId = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)
  if (!supplierId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Fornecedor inválido' }, 400)
  }

  const parsed = updateSupplierSchema.safeParse(await request.json().catch(() => null))
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

  const updates: Record<string, unknown> = {
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome
  if (parsed.data.documento !== undefined) updates.documento = parsed.data.documento || null
  if (parsed.data.email !== undefined) updates.email = parsed.data.email || null
  if (parsed.data.telefone !== undefined) updates.telefone = parsed.data.telefone || null
  if (parsed.data.cidade !== undefined) updates.cidade = parsed.data.cidade || null
  if (parsed.data.estado !== undefined) updates.estado = parsed.data.estado || null
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.score_manual !== undefined) updates.score_manual = parsed.data.score_manual
  if (parsed.data.notas !== undefined) updates.notas = parsed.data.notas || null

  const { data, error } = await supabase
    .from('fornecedores')
    .update(updates)
    .eq('id', supplierId)
    .eq('org_id', orgId)
    .select(SUPPLIER_COLUMNS)
    .single()

  if (error || !data) {
    log('error', 'fornecedores.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores/[id]',
      supplierId,
      error: error?.message || 'unknown',
    })
    return fail(
      request,
      { code: error ? API_ERROR_CODES.DB_ERROR : API_ERROR_CODES.NOT_FOUND, message: error?.message || 'Fornecedor não encontrado' },
      error ? 500 : 404
    )
  }

  return ok(request, data as SupplierRecord)
})

export const DELETE = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const supplierId = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)
  if (!supplierId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Fornecedor inválido' }, 400)
  }

  const { error } = await supabase
    .from('fornecedores')
    .delete()
    .eq('id', supplierId)
    .eq('org_id', orgId)

  if (error) {
    log('error', 'fornecedores.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores/[id]',
      supplierId,
      error: error.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  return ok(request, { id: supplierId })
})
