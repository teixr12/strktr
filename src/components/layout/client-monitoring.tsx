'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { page, track } from '@/lib/analytics/client'

function sendMonitoringEvent(payload: Record<string, unknown>) {
  fetch('/api/v1/monitoring/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

export function ClientMonitoring() {
  const pathname = usePathname()

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      track('reliability_client_error', {
        source: 'web',
        entity_type: 'window_error',
        entity_id: window.location.pathname,
        outcome: 'fail',
        error_message: event.message || 'Erro desconhecido',
      }).catch(() => undefined)

      sendMonitoringEvent({
        type: 'window_error',
        message: event.message || 'Erro desconhecido',
        stack: event.error?.stack || null,
        path: window.location.pathname,
      })
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message =
        typeof reason === 'string'
          ? reason
          : reason?.message || 'Promise rejection sem mensagem'

      track('reliability_client_error', {
        source: 'web',
        entity_type: 'unhandled_rejection',
        entity_id: window.location.pathname,
        outcome: 'fail',
        error_message: message,
      }).catch(() => undefined)

      sendMonitoringEvent({
        type: 'unhandled_rejection',
        message,
        stack: reason?.stack || null,
        path: window.location.pathname,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    page(pathname || '/').catch(() => undefined)
  }, [pathname])

  return null
}
