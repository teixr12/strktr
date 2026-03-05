import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ReceiptReviewPayload,
  TransacaoAttachmentSummary,
  TransacaoReceiptIntakeSummary,
} from '@/shared/types/transacao-receipts'
import { resolveFinanceReceiptSignedUrl } from '@/server/services/finance/receipt-storage'

type ReceiptIntakeRow = {
  id: string
  org_id: string
  transacao_id: string | null
  storage_key: string
  original_filename: string
  mime_type: string
  size_bytes: number
  status: string
  review_payload: ReceiptReviewPayload | null
  created_at: string
  updated_at: string
}

type AttachmentRow = {
  id: string
  org_id: string
  transacao_id: string
  receipt_intake_id: string | null
  storage_key: string
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export async function toReceiptIntakeSummary(
  row: ReceiptIntakeRow
): Promise<TransacaoReceiptIntakeSummary> {
  return {
    id: row.id,
    transacao_id: row.transacao_id,
    status: row.status as TransacaoReceiptIntakeSummary['status'],
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    signed_url: await resolveFinanceReceiptSignedUrl(row.storage_key),
    review_payload: row.review_payload,
  }
}

export async function toAttachmentSummary(
  row: AttachmentRow
): Promise<TransacaoAttachmentSummary> {
  return {
    id: row.id,
    transacao_id: row.transacao_id,
    receipt_intake_id: row.receipt_intake_id,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    signed_url: await resolveFinanceReceiptSignedUrl(row.storage_key),
  }
}

export async function linkReceiptIntakeToTransaction(input: {
  supabase: SupabaseClient
  orgId: string
  transacaoId: string
  receiptIntakeId: string
  actorUserId: string
}): Promise<
  | { ok: true; attachment: TransacaoAttachmentSummary }
  | { ok: false; reason: 'not_found' | 'already_linked' | 'db_error'; message: string }
> {
  const { data: intake, error: intakeError } = await input.supabase
    .from('transacao_receipt_intakes')
    .select(
      'id, org_id, transacao_id, storage_key, original_filename, mime_type, size_bytes, status, review_payload, created_at, updated_at'
    )
    .eq('id', input.receiptIntakeId)
    .eq('org_id', input.orgId)
    .single()

  if (intakeError || !intake) {
    return { ok: false, reason: 'not_found', message: 'Recibo não encontrado para esta organização.' }
  }

  if (intake.transacao_id && intake.transacao_id !== input.transacaoId) {
    return { ok: false, reason: 'already_linked', message: 'Recibo já vinculado a outra transação.' }
  }

  const { data: existingAttachment } = await input.supabase
    .from('transacao_anexos')
    .select('id, org_id, transacao_id, receipt_intake_id, storage_key, original_filename, mime_type, size_bytes, created_at')
    .eq('org_id', input.orgId)
    .eq('transacao_id', input.transacaoId)
    .eq('receipt_intake_id', input.receiptIntakeId)
    .maybeSingle()

  if (existingAttachment) {
    return {
      ok: true,
      attachment: await toAttachmentSummary(existingAttachment),
    }
  }

  const { data: attachment, error: attachmentError } = await input.supabase
    .from('transacao_anexos')
    .insert({
      org_id: input.orgId,
      transacao_id: input.transacaoId,
      receipt_intake_id: intake.id,
      storage_key: intake.storage_key,
      original_filename: intake.original_filename,
      mime_type: intake.mime_type,
      size_bytes: intake.size_bytes,
      created_by: input.actorUserId,
    })
    .select('id, org_id, transacao_id, receipt_intake_id, storage_key, original_filename, mime_type, size_bytes, created_at')
    .single()

  if (attachmentError || !attachment) {
    return {
      ok: false,
      reason: 'db_error',
      message: attachmentError?.message || 'Falha ao vincular recibo à transação.',
    }
  }

  const nextStatus = intake.review_payload ? 'linked' : 'linked'
  const { error: updateError } = await input.supabase
    .from('transacao_receipt_intakes')
    .update({
      transacao_id: input.transacaoId,
      status: nextStatus,
    })
    .eq('id', intake.id)
    .eq('org_id', input.orgId)

  if (updateError) {
    return {
      ok: false,
      reason: 'db_error',
      message: updateError.message,
    }
  }

  return {
    ok: true,
    attachment: await toAttachmentSummary(attachment),
  }
}
