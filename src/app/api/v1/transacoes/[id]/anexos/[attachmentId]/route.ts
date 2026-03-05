import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { withFinanceReceiptsAuth } from '@/lib/finance-receipts/api'
import { deleteFinanceReceiptObject } from '@/server/services/finance/receipt-storage'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const handler = withFinanceReceiptsAuth(
    'can_manage_finance',
    async (_request, { supabase, orgId }) => {
      const { id, attachmentId } = await params

      const { data: attachment, error } = await supabase
        .from('transacao_anexos')
        .select('id, transacao_id, receipt_intake_id, storage_key, url')
        .eq('id', attachmentId)
        .eq('org_id', orgId)
        .eq('transacao_id', id)
        .single()

      if (error || !attachment) {
        return fail(request, { code: API_ERROR_CODES.NOT_FOUND, message: 'Anexo não encontrado.' }, 404)
      }

      const storageRemoved = attachment.storage_key
        ? await deleteFinanceReceiptObject(attachment.storage_key)
        : true
      if (!storageRemoved) {
        return fail(
          request,
          { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao remover arquivo do storage privado.' },
          500
        )
      }

      const { error: deleteError } = await supabase
        .from('transacao_anexos')
        .delete()
        .eq('id', attachmentId)
        .eq('org_id', orgId)

      if (deleteError) {
        return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: deleteError.message }, 500)
      }

      if (attachment.receipt_intake_id) {
        const { data: intake } = await supabase
          .from('transacao_receipt_intakes')
          .select('review_payload')
          .eq('id', attachment.receipt_intake_id)
          .eq('org_id', orgId)
          .maybeSingle()

        await supabase
          .from('transacao_receipt_intakes')
          .update({
            transacao_id: null,
            status: intake?.review_payload ? 'ready_for_review' : 'uploaded',
          })
          .eq('id', attachment.receipt_intake_id)
          .eq('org_id', orgId)
      }

      return ok(request, { success: true })
    }
  )

  return handler(request)
}
