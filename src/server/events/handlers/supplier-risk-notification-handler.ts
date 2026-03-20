import { log } from '@/lib/api/logger'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { EventHandler } from '@/server/events/event-types'
import type { SupplierRiskThresholdEvent } from '@/server/events/supplier-events'
import { sendSlackMessage } from '@/server/notifications/slack'

const SUPPLIER_NOTIFICATION_COLUMNS = 'nome, status'

export const supplierRiskNotificationHandler: EventHandler<SupplierRiskThresholdEvent> = async (
  event,
  ctx
) => {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    log('warn', 'supplier.risk.notification.service_role_missing', {
      requestId: ctx.requestId,
      orgId: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      supplierId: event.supplier_id,
    })
    return
  }

  const { data: supplier, error } = await supabase
    .from('fornecedores')
    .select(SUPPLIER_NOTIFICATION_COLUMNS)
    .eq('id', event.supplier_id)
    .eq('org_id', event.org_id)
    .maybeSingle()

  if (error) {
    log('error', 'supplier.risk.notification.lookup_failed', {
      requestId: ctx.requestId,
      orgId: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      supplierId: event.supplier_id,
      error: error.message,
    })
    return
  }

  if (!supplier) {
    log('warn', 'supplier.risk.notification.not_found', {
      requestId: ctx.requestId,
      orgId: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      supplierId: event.supplier_id,
    })
    return
  }

  const delivered = await sendSlackMessage(
    {
      text: `🚨 Supplier moved to WATCHLIST\n\nSupplier: ${supplier.nome}\nOverdue items: ${event.overdue_count}\nStatus: ${supplier.status}`,
    },
    {
      requestId: ctx.requestId,
      orgId: event.org_id,
      route: ctx.route,
      userId: ctx.userId,
      eventType: event.type,
      supplierId: event.supplier_id,
    }
  )

  if (!delivered) {
    log('warn', 'supplier.risk.notification.skipped', {
      requestId: ctx.requestId,
      orgId: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      supplierId: event.supplier_id,
      overdueCount: event.overdue_count,
    })
    return
  }

  log('info', 'supplier.risk.notification.sent', {
    requestId: ctx.requestId,
    orgId: event.org_id,
    userId: ctx.userId,
    route: ctx.route,
    eventType: event.type,
    supplierId: event.supplier_id,
    overdueCount: event.overdue_count,
  })
}
