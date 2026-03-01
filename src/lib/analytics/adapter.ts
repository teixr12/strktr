'use client'

import { createClient } from '@/lib/supabase/client'
import { featureFlags } from '@/lib/feature-flags'
import type {
  AnalyticsEventType,
  AnalyticsProps,
  AnalyticsTrackInput,
} from '@/shared/types/analytics'

type AnalyticsIdentity = {
  id: string
  email?: string | null
  name?: string | null
}

type AnalyticsGroup = {
  id: string
  name?: string | null
  plan?: string | null
}

type SessionContext = {
  token: string | null
  userId: string | null
}

const INTERNAL_ANALYTICS_URL = '/api/v1/analytics/events'
const POSTHOG_DEFAULT_HOST = 'https://app.posthog.com'

let cachedAnonymousId: string | null = null

// Cache session context to avoid redundant Supabase calls per analytics event
const SESSION_CACHE_TTL_MS = 60_000 // 1 minute
let cachedSession: SessionContext | null = null
let sessionCacheTimestamp = 0

function getAnonymousId() {
  if (cachedAnonymousId) return cachedAnonymousId
  if (typeof window === 'undefined') return 'server-anon'

  const existing = window.localStorage.getItem('strktr_analytics_anon_id')
  if (existing) {
    cachedAnonymousId = existing
    return existing
  }

  const next = crypto.randomUUID()
  window.localStorage.setItem('strktr_analytics_anon_id', next)
  cachedAnonymousId = next
  return next
}

function analyticsEnabled() {
  return featureFlags.productAnalytics
}

function externalAnalyticsEnabled() {
  return (
    featureFlags.analyticsExternalV1 &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST)
  )
}

async function getSessionContext(): Promise<SessionContext> {
  const now = Date.now()
  if (cachedSession && now - sessionCacheTimestamp < SESSION_CACHE_TTL_MS) {
    return cachedSession
  }
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    cachedSession = {
      token: data.session?.access_token || null,
      userId: data.session?.user?.id || null,
    }
    sessionCacheTimestamp = now
    return cachedSession
  } catch {
    return { token: null, userId: null }
  }
}

function buildDefaultPayload(input?: AnalyticsProps): AnalyticsProps {
  const route = typeof window !== 'undefined' ? window.location.pathname : null
  return {
    route,
    source: 'web',
    ...input,
  }
}

async function sendInternal(input: AnalyticsTrackInput, token: string | null) {
  if (!token) return

  await fetch(INTERNAL_ANALYTICS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      eventType: input.eventType,
      entityType: input.entityType || input.payload?.entity_type || 'unknown',
      entityId:
        input.entityId ||
        input.payload?.entity_id ||
        (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
      payload: input.payload || {},
    }),
  }).catch(() => undefined)
}

async function sendPosthogCapture(
  eventType: AnalyticsEventType,
  payload: AnalyticsProps,
  session: SessionContext
) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST
  if (!key || !host) return

  const distinctId = payload.user_id || session.userId || getAnonymousId()
  const captureUrl = `${host.replace(/\/$/, '')}/capture/`

  await fetch(captureUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: key,
      event: eventType,
      distinct_id: distinctId,
      properties: payload,
    }),
    keepalive: true,
  }).catch(() => undefined)
}

async function sendPosthogIdentify(identity: AnalyticsIdentity) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST
  if (!key || !host) return

  const identifyUrl = `${host.replace(/\/$/, '')}/identify/`
  await fetch(identifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      distinct_id: identity.id,
      properties: {
        email: identity.email || null,
        name: identity.name || null,
      },
    }),
    keepalive: true,
  }).catch(() => undefined)
}

export async function track(eventType: AnalyticsEventType, props?: AnalyticsProps) {
  if (!analyticsEnabled()) return

  const session = await getSessionContext()
  const payload = buildDefaultPayload({
    ...props,
    user_id: props?.user_id || session.userId,
    outcome: props?.outcome || 'success',
  })

  const input: AnalyticsTrackInput = {
    eventType,
    entityType: props?.entity_type || 'unknown',
    entityId: props?.entity_id || undefined,
    payload,
  }

  // Send internal and external analytics in parallel instead of sequentially
  const promises: Promise<void>[] = [sendInternal(input, session.token)]
  if (externalAnalyticsEnabled()) {
    promises.push(sendPosthogCapture(eventType, payload, session))
  }
  await Promise.allSettled(promises)
}

export async function identify(identity: AnalyticsIdentity) {
  if (!analyticsEnabled() || !externalAnalyticsEnabled()) return
  await sendPosthogIdentify(identity)
}

export async function group(groupInput: AnalyticsGroup) {
  if (!analyticsEnabled()) return
  await track('core_complete', {
    source: 'system',
    entity_type: 'workspace',
    entity_id: groupInput.id,
    org_id: groupInput.id,
    group_name: groupInput.name || null,
    group_plan: groupInput.plan || null,
  })
}

export async function page(route: string) {
  await track('PageViewed', {
    source: 'web',
    entity_type: 'page',
    entity_id: route,
    route,
  })
}
