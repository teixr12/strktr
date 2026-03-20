import { after } from 'next/server'
import { log } from '@/lib/api/logger'
import { dispatchEvent } from '@/server/events/event-bus'
import type { DomainEvent, EventDispatchMetadata } from '@/server/events/event-types'

export function publishAfterResponse(event: DomainEvent, metadata: EventDispatchMetadata) {
  try {
    after(async () => {
      try {
        await dispatchEvent(event, metadata)
      } catch (error) {
        log('error', 'events.dispatch.failed', {
          requestId: metadata.requestId,
          orgId: event.org_id,
          userId: metadata.userId,
          route: metadata.route,
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Falha ao despachar evento',
        })
      }
    })
  } catch (error) {
    log('error', 'events.publish.failed', {
      requestId: metadata.requestId,
      orgId: event.org_id,
      userId: metadata.userId,
      route: metadata.route,
      eventType: event.type,
      error: error instanceof Error ? error.message : 'Falha ao publicar evento',
    })
  }
}
