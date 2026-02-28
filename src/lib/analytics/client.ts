'use client'

import { track, identify, group, page } from '@/lib/analytics/adapter'
import type { AnalyticsEventType, AnalyticsProps } from '@/shared/types/analytics'

interface AnalyticsPayload {
  eventType: AnalyticsEventType
  entityType?: string
  entityId?: string
  payload?: AnalyticsProps
}

export async function trackEvent(input: AnalyticsPayload) {
  await track(input.eventType, {
    ...input.payload,
    entity_type: input.entityType || input.payload?.entity_type || 'unknown',
    entity_id: input.entityId || input.payload?.entity_id || null,
  })
}

export { track, identify, group, page }
