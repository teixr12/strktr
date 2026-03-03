import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyticsEventType } from '@/shared/types/analytics'

export type ProductEventType = AnalyticsEventType

interface ProductEventInput {
  supabase: SupabaseClient
  orgId?: string | null
  userId?: string | null
  eventType: ProductEventType
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
  mirrorExternal?: boolean
}

const POSTHOG_DEFAULT_HOST = 'https://app.posthog.com'

async function mirrorToPosthog(input: ProductEventInput) {
  const externalEnabled =
    process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1 === 'true' ||
    process.env.FF_ANALYTICS_EXTERNAL_V1 === 'true'
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_API_KEY
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    process.env.POSTHOG_HOST ||
    POSTHOG_DEFAULT_HOST

  if (!externalEnabled) return
  if (!key) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'telemetry.posthog.mirror_skipped_missing_key',
        eventType: input.eventType,
      })
    )
    return
  }

  const distinctId =
    (typeof input.userId === 'string' && input.userId.trim()) ||
    (typeof input.orgId === 'string' && input.orgId.trim()
      ? `org:${input.orgId}`
      : `entity:${input.entityType}:${input.entityId}`)

  const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: key,
      event: input.eventType,
      distinct_id: distinctId,
      properties: {
        source: 'server',
        user_id: input.userId ?? null,
        org_id: input.orgId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        ...input.payload,
      },
    }),
  }).catch(() => undefined)

  if (!response || !response.ok) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'telemetry.posthog.mirror_failed',
        eventType: input.eventType,
        status: response?.status ?? null,
      })
    )
  }
}

export async function emitProductEvent(input: ProductEventInput) {
  const persistedUserId =
    typeof input.userId === 'string' && input.userId.trim() ? input.userId : null
  // If the table is not available yet, do not break runtime flows.
  await input.supabase.from('eventos_produto').insert({
    org_id: input.orgId ?? null,
    user_id: persistedUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload ?? {},
  })

  if (input.mirrorExternal) {
    await mirrorToPosthog(input)
  }
}
