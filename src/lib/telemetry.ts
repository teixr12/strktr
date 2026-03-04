import type { SupabaseClient } from '@supabase/supabase-js'
import { isFlagDisabledByDefault } from '@/lib/feature-flags'
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
  eventId?: string | null
  occurredAt?: string | null
}

type PosthogMirrorInput = Omit<ProductEventInput, 'supabase' | 'mirrorExternal'>

const POSTHOG_DEFAULT_HOST = 'https://app.posthog.com'

export type MirrorResult = {
  ok: boolean
  skipped?: 'flag_disabled' | 'missing_key'
  status: number | null
  statusText: string | null
}

function normalizeEnv(value: string | undefined | null): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

function resolvePosthogCaptureKey() {
  return (
    normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY) ||
    normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) ||
    normalizeEnv(process.env.POSTHOG_PROJECT_TOKEN) ||
    normalizeEnv(process.env.POSTHOG_PROJECT_API_KEY) ||
    null
  )
}

function resolveExternalAnalyticsEnabled() {
  return (
    isFlagDisabledByDefault(normalizeEnv(process.env.NEXT_PUBLIC_FF_ANALYTICS_EXTERNAL_V1) || undefined) ||
    isFlagDisabledByDefault(normalizeEnv(process.env.FF_ANALYTICS_EXTERNAL_V1) || undefined)
  )
}

function normalizeEventTimestamp(value: string | null | undefined): string | null {
  const raw = (value || '').trim()
  if (!raw) return null
  const normalizedCandidate = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const parsed = new Date(normalizedCandidate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

async function posthogCapture(host: string, body: Record<string, unknown>): Promise<MirrorResult> {
  const response = await fetch(`${host.replace(/\/$/, '')}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch(() => undefined)

  return {
    ok: Boolean(response?.ok),
    status: response?.status ?? null,
    statusText: response?.statusText ?? null,
  }
}

async function mirrorToPosthog(input: PosthogMirrorInput): Promise<MirrorResult> {
  const externalEnabled =
    resolveExternalAnalyticsEnabled()
  const key = resolvePosthogCaptureKey()
  const host =
    normalizeEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST) ||
    normalizeEnv(process.env.POSTHOG_HOST) ||
    POSTHOG_DEFAULT_HOST

  if (!externalEnabled) {
    return { ok: false, skipped: 'flag_disabled', status: null, statusText: null }
  }
  if (!key) {
    return { ok: false, skipped: 'missing_key', status: null, statusText: null }
  }

  const distinctId =
    (typeof input.userId === 'string' && input.userId.trim()) ||
    (typeof input.orgId === 'string' && input.orgId.trim()
      ? `org:${input.orgId}`
      : `entity:${input.entityType}:${input.entityId}`)

  const eventId =
    (typeof input.eventId === 'string' && input.eventId.trim()) || `${input.eventType}:${input.entityId}`
  const properties: Record<string, unknown> = {
    source: 'server',
    user_id: input.userId ?? null,
    org_id: input.orgId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    ...input.payload,
    _event_id: eventId,
    $insert_id: eventId,
  }
  const normalizedTimestamp = normalizeEventTimestamp(input.occurredAt)

  const captureBody: Record<string, unknown> = {
    api_key: key,
    event: input.eventType,
    distinct_id: distinctId,
    properties,
  }
  if (normalizedTimestamp) {
    captureBody.timestamp = normalizedTimestamp
  }

  const firstAttempt = await posthogCapture(host, captureBody)
  if (firstAttempt.ok) return firstAttempt

  // Retry once to reduce transient network drift during spikes.
  await new Promise((resolve) => setTimeout(resolve, 200))
  return posthogCapture(host, captureBody)
}

export async function mirrorProductEventExternal(
  input: PosthogMirrorInput
): Promise<MirrorResult> {
  return mirrorToPosthog(input)
}

export async function emitProductEvent(input: ProductEventInput) {
  const persistedUserId =
    typeof input.userId === 'string' && input.userId.trim() ? input.userId : null

  let persistedEventId: string | null = input.eventId || null
  let persistedOccurredAt: string | null = input.occurredAt || null

  // If the table is not available yet, do not break runtime flows.
  const { data: insertedEvent } = await input.supabase
    .from('eventos_produto')
    .insert({
      org_id: input.orgId ?? null,
      user_id: persistedUserId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      payload: input.payload ?? {},
    })
    .select('id, created_at')
    .single()

  if (insertedEvent) {
    persistedEventId = (insertedEvent.id as string | null) || persistedEventId
    persistedOccurredAt = (insertedEvent.created_at as string | null) || persistedOccurredAt
  }

  if (input.mirrorExternal) {
    const mirrorResult = await mirrorToPosthog({
      orgId: input.orgId,
      userId: input.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      eventId: persistedEventId,
      occurredAt: persistedOccurredAt,
    })

    if (!mirrorResult.ok) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          message:
            mirrorResult.skipped === 'flag_disabled'
              ? 'telemetry.posthog.mirror_skipped_flag_disabled'
              : mirrorResult.skipped === 'missing_key'
                ? 'telemetry.posthog.mirror_skipped_missing_key'
                : 'telemetry.posthog.mirror_failed',
          eventType: input.eventType,
          eventId: persistedEventId,
          status: mirrorResult.status,
          statusText: mirrorResult.statusText,
        })
      )
    }
  }
}
