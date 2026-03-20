import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { isBureaucracyEnabled, isBureaucracyEnabledForCurrentOrg } from '@/lib/bureaucracy/feature'
import { withSupplierManagementAuth } from '@/lib/supplier-management/api'
import { isSupplierIntelligenceEnabled } from '@/lib/supplier-intelligence/feature'
import { fetchSupplierIntelligence } from '@/server/services/supplier-intelligence-service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const GET = withSupplierManagementAuth('can_manage_finance', async (request, { supabase, requestId, orgId, user }) => {
  if (!isSupplierIntelligenceEnabled()) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Recurso não encontrado' }, 404)
  }

  if (!isBureaucracyEnabled() || !isBureaucracyEnabledForCurrentOrg(orgId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Recurso não encontrado' }, 404)
  }

  const supplierId = new URL(request.url).searchParams.get('supplier_id')?.trim() || ''
  if (!supplierId) {
    return fail(request, { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'supplier_id é obrigatório' }, 400)
  }

  if (!UUID_PATTERN.test(supplierId)) {
    return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Fornecedor não encontrado' }, 404)
  }

  try {
    const payload = await fetchSupplierIntelligence(supabase, orgId, supplierId)

    if (!payload) {
      log('warn', 'fornecedores.intelligence.not_found', {
        requestId,
        orgId,
        userId: user.id,
        route: '/api/v1/fornecedores/intelligence',
        supplierId,
      })
      return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Fornecedor não encontrado' }, 404)
    }

    return ok(request, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao carregar inteligência do fornecedor'
    log('error', 'fornecedores.intelligence.failed', {
      requestId,
      orgId,
      userId: user.id,
      route: '/api/v1/fornecedores/intelligence',
      supplierId,
      error: message,
    })
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message }, 500)
  }
})
