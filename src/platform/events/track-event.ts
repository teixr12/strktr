import type {
  AnalyticsEventType,
  AnalyticsOutcome,
  AnalyticsProps,
  AnalyticsSource,
} from '@/shared/types/analytics'
import { ANALYTICS_EVENT_TYPES } from '@/shared/types/analytics'

const EVENT_REGISTRY = new Set<string>(ANALYTICS_EVENT_TYPES)

export type TrackEventInput = {
  eventType: AnalyticsEventType
  entity_type: string
  entity_id: string
  source: AnalyticsSource
  outcome: AnalyticsOutcome
  payload?: AnalyticsProps
}

export type EventEmitter = (
  eventType: AnalyticsEventType,
  payload: AnalyticsProps
) => Promise<void> | void

export function isRegisteredEvent(eventType: string): eventType is AnalyticsEventType {
  return EVENT_REGISTRY.has(eventType)
}

export function buildTrackPayload(input: TrackEventInput): AnalyticsProps {
  return {
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    source: input.source,
    outcome: input.outcome,
    ...(input.payload || {}),
  }
}

export async function trackEvent(input: TrackEventInput, emit?: EventEmitter) {
  if (!isRegisteredEvent(input.eventType)) {
    throw new Error(`Unregistered analytics event: ${input.eventType}`)
  }

  const payload = buildTrackPayload(input)
  if (emit) {
    await emit(input.eventType, payload)
  }

  return {
    eventType: input.eventType,
    payload,
  }
}
