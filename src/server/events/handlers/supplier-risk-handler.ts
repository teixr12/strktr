import { log } from '@/lib/api/logger'
import { createServiceRoleClient } from '@/lib/supabase/service'
import type { BureaucracyItemChangedEvent } from '@/server/events/bureaucracy-events'
import type { EventHandler } from '@/server/events/event-types'
import { buildSupplierRiskThresholdEvent } from '@/server/events/supplier-events'
import {
  buildStoredSupplierIntelligenceSnapshot,
  loadLiveSupplierIntelligenceBody,
} from '@/server/services/supplier-intelligence-service'

function getAffectedSupplierIds(event: BureaucracyItemChangedEvent): string[] {
  return Array.from(new Set([event.supplier_id, event.previous_supplier_id].filter((value): value is string => Boolean(value))))
}

export const supplierRiskHandler: EventHandler<BureaucracyItemChangedEvent> = async (event, ctx) => {
  const affectedSupplierIds = getAffectedSupplierIds(event)
  if (affectedSupplierIds.length === 0) {
    return
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    log('warn', 'supplier.risk.service_role_missing', {
      requestId: ctx.requestId,
      orgId: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      itemId: event.item_id,
      supplierId: event.supplier_id,
    })
    return
  }

  for (const supplierId of affectedSupplierIds) {
    const body = await loadLiveSupplierIntelligenceBody(supabase, event.org_id, supplierId)
    if (!body) {
      continue
    }

    const snapshot = buildStoredSupplierIntelligenceSnapshot(body)
    const { error: snapshotError } = await supabase
      .from('fornecedores')
      .update({
        supplier_intelligence: snapshot,
      })
      .eq('id', supplierId)
      .eq('org_id', event.org_id)

    if (snapshotError) {
      throw new Error(snapshotError.message)
    }

    if (body.supplier.status !== 'active' || body.metrics.overdue_count < 3) {
      continue
    }

    const nowIso = new Date().toISOString()
    const { data: updatedSupplier, error: updateError } = await supabase
      .from('fornecedores')
      .update({
        status: 'watchlist',
        updated_at: nowIso,
      })
      .eq('id', supplierId)
      .eq('org_id', event.org_id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()

    if (updateError) {
      throw new Error(updateError.message)
    }

    if (!updatedSupplier) {
      continue
    }

    log('info', 'supplier.risk.threshold_reached', {
      requestId: ctx.requestId,
      org_id: event.org_id,
      userId: ctx.userId,
      route: ctx.route,
      eventType: event.type,
      itemId: event.item_id,
      supplierId,
      overdueCount: body.metrics.overdue_count,
      openItemsTotal: body.metrics.open_items_total,
    })

    await ctx.emit(
      buildSupplierRiskThresholdEvent({
        org_id: event.org_id,
        supplier_id: supplierId,
        overdue_count: body.metrics.overdue_count,
      })
    )
  }
}
