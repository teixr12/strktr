import { createServiceRoleClient } from '@/lib/supabase/service'

export const FINANCE_RECEIPTS_BUCKET = 'finance-receipts'
export const MAX_RECEIPT_FILE_SIZE_BYTES = 15 * 1024 * 1024
export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const

export function isAllowedReceiptMimeType(mimeType: string): boolean {
  return ALLOWED_RECEIPT_MIME_TYPES.includes(mimeType as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number])
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export async function uploadFinanceReceipt(input: {
  orgId: string
  intakeId: string
  filename: string
  mimeType: string
  content: Buffer
}): Promise<{ bucket: string; storageKey: string } | null> {
  const service = createServiceRoleClient()
  if (!service) return null

  const safeName = sanitizeFilename(input.filename || 'receipt')
  const storageKey = `${input.orgId}/${input.intakeId}/${Date.now()}-${safeName}`
  const upload = await service.storage.from(FINANCE_RECEIPTS_BUCKET).upload(storageKey, input.content, {
    contentType: input.mimeType,
    upsert: false,
  })

  if (upload.error) return null

  return {
    bucket: FINANCE_RECEIPTS_BUCKET,
    storageKey,
  }
}

export async function resolveFinanceReceiptSignedUrl(
  storageKey: string,
  ttlSeconds = 60 * 60
): Promise<string | null> {
  const service = createServiceRoleClient()
  if (!service) return null
  const signed = await service.storage
    .from(FINANCE_RECEIPTS_BUCKET)
    .createSignedUrl(storageKey, ttlSeconds)

  if (signed.error || !signed.data?.signedUrl) return null
  return signed.data.signedUrl
}

export async function deleteFinanceReceiptObject(storageKey: string): Promise<boolean> {
  const service = createServiceRoleClient()
  if (!service) return false

  const result = await service.storage.from(FINANCE_RECEIPTS_BUCKET).remove([storageKey])
  return !result.error
}
