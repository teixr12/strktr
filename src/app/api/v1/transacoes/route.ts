import { withApiAuth } from '@/lib/api/with-auth'
import { fail, ok } from '@/lib/api/response'
import { log } from '@/lib/api/logger'
import { API_ERROR_CODES } from '@/lib/api/errors'
import { createTransacaoSchema } from '@/shared/schemas/business'
import { buildPaginationMeta, getPaginationFromSearchParams } from '@/lib/api/pagination'
import { linkReceiptIntakeToTransaction } from '@/server/services/finance/receipt-linking'
import { isFinanceReceiptsEnabledForOrg } from '@/server/feature-flags/wave2-canary'

export const GET = withApiAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo')
  const obra_id = searchParams.get('obra_id')
  const { page, pageSize, offset } = getPaginationFromSearchParams(searchParams, {
    defaultPageSize: 50,
    maxPageSize: 100,
  })

  // Single query: fetch data + count in one round-trip (eliminates duplicate DB call)
  let query = supabase
    .from('transacoes')
    .select('*, obras(nome)', { count: 'exact' })
    .eq('org_id', orgId)
  if (tipo) query = query.eq('tipo', tipo)
  if (obra_id) query = query.eq('obra_id', obra_id)
  query = query.order('data', { ascending: false }).range(offset, offset + pageSize - 1)

  const { data, count, error: dbError } = await query
  if (dbError) {
    log('error', 'transacoes.get.failed', { requestId, orgId, userId: user.id, route: '/api/v1/transacoes', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  const total = count ?? data?.length ?? 0

  return ok(request, data ?? [], buildPaginationMeta(data?.length || 0, total, page, pageSize))
})

export const POST = withApiAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  const parsed = createTransacaoSchema.safeParse(await request.json())
  if (!parsed.success) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: parsed.error.issues[0]?.message || 'Payload inválido' }, 400)
  }
  const body = parsed.data
  const { receipt_intake_id: receiptIntakeId, ...transacaoInput } = body

  if (receiptIntakeId && !isFinanceReceiptsEnabledForOrg(orgId)) {
    return fail(
      request,
      { code: API_ERROR_CODES.NOT_FOUND, message: 'Recurso não encontrado' },
      404
    )
  }

  const { data, error: dbError } = await supabase
    .from('transacoes')
    .insert({
      ...transacaoInput,
      user_id: user.id,
      org_id: orgId,
      obra_id: transacaoInput.obra_id || null,
      forma_pagto: transacaoInput.forma_pagto || 'Não informado',
      notas: transacaoInput.notas || null,
    })
    .select('*, obras(nome)')
    .single()

  if (dbError) {
    log('error', 'transacoes.create.failed', { requestId, orgId, userId: user.id, route: '/api/v1/transacoes', error: dbError.message })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: dbError.message }, 500)
  }

  if (receiptIntakeId) {
    const linked = await linkReceiptIntakeToTransaction({
      supabase,
      orgId,
      transacaoId: data.id,
      receiptIntakeId,
      actorUserId: user.id,
    })

    if (!linked.ok) {
      await supabase.from('transacoes').delete().eq('id', data.id).eq('org_id', orgId)
      const status =
        linked.reason === 'already_linked'
          ? 409
          : linked.reason === 'not_found'
            ? 404
            : 500
      return fail(
        request,
        {
          code:
            linked.reason === 'already_linked'
              ? API_ERROR_CODES.CONFLICT
              : linked.reason === 'not_found'
                ? API_ERROR_CODES.NOT_FOUND
                : API_ERROR_CODES.DB_ERROR,
          message: linked.message,
        },
        status
      )
    }
  }

  return ok(request, data, undefined, 201)
})
