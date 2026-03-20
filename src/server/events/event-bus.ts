import { log } from '@/lib/api/logger'
import type { EventDispatchContext, EventDispatchMetadata, EventHandler, DomainEvent } from '@/server/events/event-types'
import { supplierRiskHandler } from '@/server/events/handlers/supplier-risk-handler'
import { supplierRiskNotificationHandler } from '@/server/events/handlers/supplier-risk-notification-handler'

type EventByType<TType extends DomainEvent['type']> = Extract<DomainEvent, { type: TType }>
type HandlerMap = {
  [K in DomainEvent['type']]: Array<EventHandler<EventByType<K>>>
}

const HANDLERS: HandlerMap = {
  'bureaucracy.item.changed': [supplierRiskHandler],
  'supplier.risk.threshold_reached': [supplierRiskNotificationHandler],
}

export async function dispatchEvent(event: DomainEvent, metadata: EventDispatchMetadata): Promise<void> {
  const handlers = HANDLERS[event.type] as Array<EventHandler<typeof event>>
  const ctx: EventDispatchContext = {
    ...metadata,
    orgId: event.org_id,
    emit: async (nextEvent) =>
      dispatchEvent(nextEvent, {
        ...metadata,
        orgId: nextEvent.org_id,
      }),
  }

  for (const handler of handlers) {
    try {
      await handler(event, ctx)
    } catch (error) {
      log('error', 'events.handler.failed', {
        requestId: metadata.requestId,
        orgId: event.org_id,
        userId: metadata.userId,
        route: metadata.route,
        eventType: event.type,
        error: error instanceof Error ? error.message : 'Falha ao executar handler de evento',
      })
    }
  }
}
