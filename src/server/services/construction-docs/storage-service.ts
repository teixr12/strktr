import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service'

const MEDIA_BUCKETS = ['construction-docs-media']
const PDF_BUCKETS = ['construction-docs-pdfs', 'sop-pdfs', 'cronograma-pdfs']

function parseBase64Payload(base64: string): Buffer | null {
  const payload = base64.includes(',') ? base64.split(',')[1] : base64
  try {
    return Buffer.from(payload, 'base64')
  } catch {
    return null
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120)
}

export async function uploadConstructionPhoto(input: {
  orgId: string
  visitId: string
  filename: string
  mimeType: string
  base64: string
}): Promise<{ bucket: string; storageKey: string; publicUrl: string } | null> {
  const service = createServiceRoleClient()
  if (!service) return null

  const content = parseBase64Payload(input.base64)
  if (!content) return null

  const stamp = Date.now()
  const filename = sanitizeFilename(input.filename)
  for (const bucket of MEDIA_BUCKETS) {
    const storageKey = `${input.orgId}/${input.visitId}/${stamp}-${filename}`
    const upload = await service.storage.from(bucket).upload(storageKey, content, {
      contentType: input.mimeType,
      upsert: false,
    })
    if (upload.error) continue
    const publicUrl = service.storage.from(bucket).getPublicUrl(storageKey).data.publicUrl
    return { bucket, storageKey, publicUrl }
  }
  return null
}

export async function uploadConstructionPdf(input: {
  orgId: string
  documentId: string
  fileName: string
  content: Buffer
}): Promise<{ bucket: string; storageKey: string; downloadUrl: string } | null> {
  const service = createServiceRoleClient()
  if (!service) return null

  for (const bucket of PDF_BUCKETS) {
    const storageKey = `${input.orgId}/${input.documentId}/${sanitizeFilename(input.fileName)}`
    const upload = await service.storage.from(bucket).upload(storageKey, input.content, {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (upload.error) continue

    const signed = await service.storage.from(bucket).createSignedUrl(storageKey, 60 * 60 * 24 * 7)
    if (signed.error || !signed.data?.signedUrl) continue
    return { bucket, storageKey, downloadUrl: signed.data.signedUrl }
  }
  return null
}

export async function resolveDownloadUrl(
  supabase: SupabaseClient,
  bucket: string,
  storageKey: string
): Promise<string | null> {
  const signed = await supabase.storage.from(bucket).createSignedUrl(storageKey, 60 * 60)
  if (signed.error || !signed.data?.signedUrl) return null
  return signed.data.signedUrl
}

