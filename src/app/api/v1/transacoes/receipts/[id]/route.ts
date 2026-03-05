import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withFinanceReceiptsAuth } from '@/lib/finance-receipts/api'
import { toReceiptIntakeSummary } from '@/server/services/finance/receipt-linking'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const handler = withFinanceReceiptsAuth(
    'can_manage_finance',
    async (_request, { supabase, orgId }) => {
      const { id } = await params
      const { data, error } = await supabase
        .from('transacao_receipt_intakes')
        .select(
          'id, org_id, transacao_id, storage_key, original_filename, mime_type, size_bytes, status, review_payload, created_at, updated_at'
        )
        .eq('id', id)
        .eq('org_id', orgId)
        .single()

      if (error || !data) {
        return fail(
          request,
          { code: API_ERROR_CODES.NOT_FOUND, message: 'Recibo não encontrado.' },
          404
        )
      }

      return ok(request, await toReceiptIntakeSummary(data))
    }
  )

  return handler(request)
}
