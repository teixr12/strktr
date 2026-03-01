'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { ToastContext, setToastDispatch } from '@/hooks/use-toast'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  message: string
  type: ToastType
  exiting: boolean
}

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 3500
const EXIT_ANIMATION_MS = 200

const iconMap: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

let nextId = 0

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: number) => {
    // Clear any existing timer
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }

    // Start exit animation
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)))

    // Remove from DOM after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_ANIMATION_MS)
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId++
      setToasts((prev) => {
        const next = [...prev, { id, message, type, exiting: false }]
        // If we exceed the max, dismiss the oldest non-exiting toast
        const visible = next.filter((t) => !t.exiting)
        if (visible.length > MAX_VISIBLE) {
          const oldest = visible[0]
          // Schedule removal of the oldest toast
          setTimeout(() => removeToast(oldest.id), 0)
        }
        return next
      })

      // Auto-dismiss after timeout
      const timer = setTimeout(() => {
        timersRef.current.delete(id)
        removeToast(id)
      }, AUTO_DISMISS_MS)
      timersRef.current.set(id, timer)
    },
    [removeToast],
  )

  // Register the dispatch function for the imperative toast() API
  useEffect(() => {
    setToastDispatch(addToast)
    return () => setToastDispatch(null)
  }, [addToast])

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  // Don't render during SSR
  if (typeof window === 'undefined') return null

  return createPortal(
    <ToastContext.Provider value={addToast}>
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = iconMap[t.type]
          return (
            <div
              key={t.id}
              className={`toast toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
              role="alert"
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="toast-dismiss"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>,
    document.body,
  )
}
