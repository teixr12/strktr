'use client'

import { createClient } from '@/lib/supabase/client'
import { featureFlags } from '@/lib/feature-flags'

interface AnalyticsPayload {
  eventType: string
  entityType?: string
  entityId?: string
  payload?: Record<string, unknown>
}

export async function trackEvent(input: AnalyticsPayload) {
  if (!featureFlags.productAnalytics) return

  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  await fetch('/api/v1/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  }).catch(() => undefined)
}
