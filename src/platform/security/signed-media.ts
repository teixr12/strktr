import type { SupabaseClient } from '@supabase/supabase-js'

export type SignedMediaResourceType = 'default' | 'document' | 'preview' | 'avatar'

export const SIGNED_MEDIA_TTL_SECONDS: Record<SignedMediaResourceType, number> = {
  default: 60 * 60,
  document: 60 * 60 * 24,
  preview: 60 * 15,
  avatar: 60 * 30,
}

type ResolveSignedMediaInput = {
  supabase: SupabaseClient
  bucket: string
  storageKey: string
  resourceType?: SignedMediaResourceType
  ttlSeconds?: number
}

export async function resolveSignedMediaUrl(
  input: ResolveSignedMediaInput
): Promise<string | null> {
  const ttl =
    typeof input.ttlSeconds === 'number' && input.ttlSeconds > 0
      ? input.ttlSeconds
      : SIGNED_MEDIA_TTL_SECONDS[input.resourceType || 'default']

  const signed = await input.supabase.storage.from(input.bucket).createSignedUrl(input.storageKey, ttl)
  if (signed.error || !signed.data?.signedUrl) return null
  return signed.data.signedUrl
}
