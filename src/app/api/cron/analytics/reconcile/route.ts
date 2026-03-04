import { API_ERROR_CODES } from '@/lib/api/errors'
import { fail, ok } from '@/lib/api/response'
import { mirrorProductEventExternal, type ProductEventType } from '@/lib/telemetry'
import { createServiceRoleClient } from '@/lib/supabase/service'

const TARGET_EVENTS: ProductEventType[] = [
  'portal_invite_sent',
  'portal_approval_decision',
  'ChecklistItemToggled',
]

type AnalyticsEventRow = {
  id: string
  org_id: string | null
  user_id: string | null
  event_type: ProductEventType
  entity_type: string
  entity_id: string
  payload: unknown
  created_at: string
}

function isCronAuthorized(request: Request) {
  const configuredSecrets = [
    process.env.CRON_SECRET,
    process.env.ANALYTICS_RECONCILE_TOKEN,
  ]
    .map((value) => (value || '').trim())
    .filter((value) => value.length > 0)

  if (configuredSecrets.length === 0) return true

  const auth = request.headers.get('authorization') || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  return configuredSecrets.includes(bearer)
}

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(raw || '', 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function parseBoolean(raw: string | null) {
  if (!raw) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseEventFilter(raw: string | null): ProductEventType[] {
  if (!raw) return TARGET_EVENTS
  const candidates = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as ProductEventType[]
  const filtered = candidates.filter((eventType) => TARGET_EVENTS.includes(eventType))
  return filtered.length > 0 ? filtered : TARGET_EVENTS
}

function asRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return payload as Record<string, unknown>
}

function wasReconciled(payload: Record<string, unknown>) {
  return typeof payload._posthog_reconciled_at === 'string'
}

async function runAnalyticsReconcileCron(request: Request) {
  if (!isCronAuthorized(request)) {
    return fail(request, { code: API_ERROR_CODES.UNAUTHORIZED, message: 'Não autorizado para cron' }, 401)
  }

  const service = createServiceRoleClient()
  if (!service) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: 'Service role não configurado' }, 500)
  }

  const url = new URL(request.url)
  const limit = clampInt(url.searchParams.get('limit'), 300, 1, 1000)
  const lookbackHours = clampInt(url.searchParams.get('hours'), 168, 1, 720)
  const forceReplay = parseBoolean(url.searchParams.get('force'))
  const targetEvents = parseEventFilter(url.searchParams.get('eventType'))
  const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await service
    .from('eventos_produto')
    .select('id, org_id, user_id, event_type, entity_type, entity_id, payload, created_at')
    .in('event_type', targetEvents)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return fail(request, { code: API_ERROR_CODES.DB_ERROR, message: error.message }, 500)
  }

  let processed = 0
  let mirrored = 0
  let skipped = 0
  let failed = 0
  let forced = 0
  const failures: Array<{ id: string; eventType: ProductEventType; status: number | null; reason: string }> = []

  for (const row of (data || []) as AnalyticsEventRow[]) {
    processed += 1
    const payload = asRecord(row.payload)
    if (!forceReplay && wasReconciled(payload)) {
      skipped += 1
      continue
    }
    if (forceReplay && wasReconciled(payload)) {
      forced += 1
    }

    const result = await mirrorProductEventExternal({
      orgId: row.org_id,
      userId: row.user_id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload,
      eventId: row.id,
      occurredAt: row.created_at,
    })

    if (!result.ok) {
      failed += 1
      if (failures.length < 25) {
        failures.push({
          id: row.id,
          eventType: row.event_type,
          status: result.status,
          reason: result.skipped || 'mirror_failed',
        })
      }
      continue
    }

    mirrored += 1
    const mergedPayload = {
      ...payload,
      _posthog_reconciled_at: new Date().toISOString(),
      _posthog_reconcile_source: 'cron',
      _posthog_reconcile_forced: forceReplay || payload._posthog_reconcile_forced === true,
    }

    await service
      .from('eventos_produto')
      .update({ payload: mergedPayload })
      .eq('id', row.id)
  }

  return ok(request, {
    ranAt: new Date().toISOString(),
    lookbackHours,
    sinceIso,
    limit,
    forceReplay,
    targetEvents,
    processed,
    mirrored,
    skipped,
    failed,
    forced,
    failures,
  })
}

export async function GET(request: Request) {
  return runAnalyticsReconcileCron(request)
}

export async function POST(request: Request) {
  return runAnalyticsReconcileCron(request)
}
