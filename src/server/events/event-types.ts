import type { BureaucracyItemChangedEvent } from '@/server/events/bureaucracy-events'
import type { SupplierRiskThresholdEvent } from '@/server/events/supplier-events'

export type DomainEvent = BureaucracyItemChangedEvent | SupplierRiskThresholdEvent

export interface EventDispatchMetadata {
  requestId: string
  orgId: string
  route: string
  userId: string
}

export interface EventDispatchContext extends EventDispatchMetadata {
  emit: (event: DomainEvent) => Promise<void>
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  ctx: EventDispatchContext
) => Promise<void>
