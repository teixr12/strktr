import { getApiUser } from '@/lib/api/auth'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { requireDomainPermission } from '@/lib/auth/domain-permissions'
import { updateTransacaoSchema } from '@/shared/schemas/business'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { data, error: dbError } = await supabase
    .from('transacoes')
    .select('*, obras(nome)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (dbError) {
    log('error', 'transacoes.getById.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/transacoes/[id]',
      transacaoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: dbError.message }, 404)
  }

  return ok(request, data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const parsed = updateTransacaoSchema.safeParse(await request.json())
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

  const { id } = await params
  const body = parsed.data
  const { data, error: dbError } = await supabase
    .from('transacoes')
    .update({
      ...body,
      obra_id: body.obra_id === undefined ? undefined : body.obra_id || null,
      forma_pagto: body.forma_pagto === undefined ? undefined : body.forma_pagto || 'Não informado',
      notas: body.notas === undefined ? undefined : body.notas || null,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*, obras(nome)')
    .single()

  if (dbError) {
    log('error', 'transacoes.update.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/transacoes/[id]',
      transacaoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, error, requestId, orgId, role } = await getApiUser(request)
  if (!user || !supabase) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: error || 'Não autorizado' }, 401)
  }
  if (!orgId) {
    return fail(request, { code: API_ERROR_CODES.FORBIDDEN, message: 'Usuário sem organização ativa' }, 403)
  }
  const permissionError = requireDomainPermission(request, role, 'can_manage_finance')
  if (permissionError) return permissionError

  const { id } = await params
  const { error: dbError } = await supabase
    .from('transacoes')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (dbError) {
    log('error', 'transacoes.delete.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/transacoes/[id]',
      transacaoId: id,
      error: dbError.message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 400)
  }

  return ok(request, { success: true })
}
