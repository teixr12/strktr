import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnalyticsEventType } from '@/shared/types/analytics'

export type ProductEventType = AnalyticsEventType

interface ProductEventInput {
  supabase: SupabaseClient
  orgId?: string | null
  userId: string
  eventType: ProductEventType
  entityType: string
  entityId: string
  payload?: Record<string, unknown>
  mirrorExternal?: boolean
}

const POSTHOG_DEFAULT_HOST = 'https://app.posthog.com'

async function mirrorToPosthog(input: ProductEventInput) {
  const externalEnabled = process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1 !== 'false'
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST
  if (!externalEnabled || !key) return

  await fetch(`${host.replace(/\/$/, '')}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: key,
      event: input.eventType,
      distinct_id: input.userId,
      properties: {
        source: 'server',
        user_id: input.userId,
        org_id: input.orgId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId,
        ...input.payload,
      },
    }),
  }).catch(() => undefined)
}

export async function emitProductEvent(input: ProductEventInput) {
  // If the table is not available yet, do not break runtime flows.
  await input.supabase.from('eventos_produto').insert({
    org_id: input.orgId ?? null,
    user_id: input.userId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    payload: input.payload ?? {},
  })

  if (input.mirrorExternal) {
    await mirrorToPosthog(input)
  }
}
