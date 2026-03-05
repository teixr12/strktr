import { API_ERROR_CODES } from '@/lib/api/errors'
import { log } from '@/lib/api/logger'
import { fail, ok } from '@/lib/api/response'
import { withFinanceReceiptsAuth } from '@/lib/finance-receipts/api'
import {
  uploadFinanceReceipt,
  MAX_RECEIPT_FILE_SIZE_BYTES,
  isAllowedReceiptMimeType,
  deleteFinanceReceiptObject,
} from '@/server/services/finance/receipt-storage'
import { isFinanceReceiptAiEnabledForOrg } from '@/server/feature-flags/wave2-canary'
import {
  buildManualReceiptReviewPayload,
  extractReceiptReviewPayload,
  FinanceReceiptAiError,
} from '@/server/services/finance/receipt-ai'
import { toReceiptIntakeSummary } from '@/server/services/finance/receipt-linking'

export const POST = withFinanceReceiptsAuth(
  'can_manage_finance',
  async (request, { supabase, requestId, orgId, user }) => {
    const formData = await request.formData().catch(() => null)
    const file = formData?.get('file')

    if (!(file instanceof File)) {
      return fail(
        request,
        { code: API_ERROR_CODES.VALIDATION_ERROR, message: 'Arquivo do recibo é obrigatório.' },
        400
      )
    }

    if (!isAllowedReceiptMimeType(file.type || '')) {
      return fail(
        request,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Formato inválido. Envie JPG, PNG, WEBP ou PDF.',
        },
        400
      )
    }

    if (file.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
      return fail(
        request,
        {
          code: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Arquivo excede o limite de 15 MB.',
        },
        400
      )
    }

    const intakeId = crypto.randomUUID()
    const content = Buffer.from(await file.arrayBuffer())
    const upload = await uploadFinanceReceipt({
      orgId,
      intakeId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      content,
    })

    if (!upload) {
      return fail(
        request,
        { code: API_ERROR_CODES.DB_ERROR, message: 'Falha ao armazenar recibo no bucket privado.' },
        500
      )
    }

    const runAi = String(formData?.get('run_ai') || '').trim().toLowerCase() === 'true'
    let reviewPayload = buildManualReceiptReviewPayload()
    let status = 'uploaded'
    let aiPayload: unknown = null
    let ocrText: string | null = null

    if (runAi && isFinanceReceiptAiEnabledForOrg(orgId)) {
      try {
        reviewPayload = await extractReceiptReviewPayload({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          content,
        })
        status = 'ready_for_review'
        aiPayload = reviewPayload
        ocrText = reviewPayload.raw_text
      } catch (error) {
        const reason =
          error instanceof FinanceReceiptAiError ? error.reason : 'provider_failure'
        const message =
          error instanceof Error ? error.message : 'Falha ao extrair dados do recibo.'
        reviewPayload = buildManualReceiptReviewPayload({
          errorReason: reason,
          errorMessage: message,
        })
        aiPayload = {
          reason,
          message,
        }
      }
    }

    const { data, error: dbError } = await supabase
      .from('transacao_receipt_intakes')
      .insert({
        id: intakeId,
        org_id: orgId,
        created_by: user.id,
        storage_key: upload.storageKey,
        original_filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        ocr_text: ocrText,
        ai_payload: aiPayload,
        review_payload: reviewPayload,
        status,
      })
      .select(
        'id, org_id, transacao_id, storage_key, original_filename, mime_type, size_bytes, status, review_payload, created_at, updated_at'
      )
      .single()

    if (dbError || !data) {
      await deleteFinanceReceiptObject(upload.storageKey)
      log('error', 'transacao_receipt_intakes.create.failed', {
        requestId,
        route: '/api/v1/transacoes/receipts/intake',
        orgId,
        userId: user.id,
        error: dbError?.message || 'insert_failed',
      })
      return fail(
        request,
        { code: API_ERROR_CODES.DB_ERROR, message: dbError?.message || 'Falha ao registrar recibo.' },
        500
      )
    }

    return ok(request, await toReceiptIntakeSummary(data), {
      aiEnabled: isFinanceReceiptAiEnabledForOrg(orgId),
    }, 201)
  }
)
