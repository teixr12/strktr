import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withFinanceReceiptsAuth } from '@/lib/finance-receipts/api'
import { linkReceiptIntakeSchema } from '@/shared/schemas/transacao-receipts'
import {
  linkReceiptIntakeToTransaction,
  toAttachmentSummary,
} from '@/server/services/finance/receipt-linking'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const handler = withFinanceReceiptsAuth(
    'can_manage_finance',
    async (_request, { supabase, orgId }) => {
      const { id } = await params
      const { data: transacao } = await supabase
        .from('transacoes')
        .select('id')
        .eq('id', id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!transacao) {
        return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Transação não encontrada.' }, 404)
      }

      const { data, error } = await supabase
        .from('transacao_anexos')
        .select(
          'id, org_id, transacao_id, receipt_intake_id, storage_key, original_filename, mime_type, size_bytes, created_at, url, nome_arquivo, tipo_arquivo, tamanho_bytes'
        )
        .eq('org_id', orgId)
        .eq('transacao_id', id)
        .order('created_at', { ascending: false })

      if (error) {
        return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
      }

      const items = await Promise.all((data || []).map((row) => toAttachmentSummary(row)))
      return ok(request, { items })
    }
  )

  return handler(request)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const handler = withFinanceReceiptsAuth(
    'can_manage_finance',
    async (innerRequest, { supabase, orgId, user }) => {
      const { id } = await params
      const parsed = linkReceiptIntakeSchema.safeParse(await innerRequest.json().catch(() => null))

      if (!parsed.success) {
        return fail(
          innerRequest,
          {
            code: API_ERROR_CODES.VALIDATION_ERROR,
            message: parsed.error.issues[0]?.message || 'Payload inválido',
          },
          400
        )
      }

      const { data: transacao } = await supabase
        .from('transacoes')
        .select('id')
        .eq('id', id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (!transacao) {
        return fail(innerRequest, { code: API_ERROR_CODES.NOT_FOUND, message: 'Transação não encontrada.' }, 404)
      }

      const linked = await linkReceiptIntakeToTransaction({
        supabase,
        orgId,
        transacaoId: id,
        receiptIntakeId: parsed.data.receipt_intake_id,
        actorUserId: user.id,
      })

      if (!linked.ok) {
        const status =
          linked.reason === 'already_linked'
            ? 409
            : linked.reason === 'not_found'
              ? 404
              : 500
        return fail(
          innerRequest,
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

      return ok(innerRequest, linked.attachment, undefined, 201)
    }
  )

  return handler(request)
}
