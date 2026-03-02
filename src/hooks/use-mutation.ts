'use client'

import { useCallback, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api/client'
import { toast } from '@/hooks/use-toast'
import { track } from '@/lib/analytics/client'
import type { AnalyticsEventType, AnalyticsSource } from '@/shared/types/analytics'

type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface MutationOptions<TItem, TResult = TItem> {
  /** HTTP method for the mutation */
  method: MutationMethod
  /** API path — string or function that receives an item id */
  path: string | ((id: string) => string)
  /** Apply optimistic update to local state BEFORE API responds */
  optimisticUpdate?: (prev: TItem[], payload: unknown, id?: string) => TItem[]
  /** Reconcile local state AFTER API succeeds — receives server response */
  onSuccess?: (prev: TItem[], result: TResult, id?: string) => TItem[]
  /** Toast message on success (auto-detects type from method) */
  successMessage?: string
  /** Fallback toast message on error */
  errorMessage?: string
  /** Analytics event name (e.g. 'core_create', 'core_edit', 'core_delete') */
  trackEvent?: AnalyticsEventType
  /** Analytics source (e.g. 'leads') */
  trackSource?: AnalyticsSource
  /** Analytics entity type (e.g. 'lead') */
  trackEntityType?: string
  /** Called after mutation settles (success or error) — e.g., pagination refresh */
  onSettled?: () => void | Promise<void>
}

interface MutationResult {
  /** Execute the mutation */
  mutate: (payload?: unknown, id?: string) => Promise<boolean>
  /** Whether a mutation is in-flight */
  isMutating: boolean
  /** Last error message, or null */
  error: string | null
}

/**
 * Generic optimistic mutation hook. Works with local `useState` arrays.
 *
 * @example
 * const deleteMutation = useMutation<Lead>(setLeads, {
 *   method: 'DELETE',
 *   path: (id) => `/api/v1/leads/${id}`,
 *   optimisticUpdate: (prev, _payload, id) => prev.filter(l => l.id !== id),
 *   successMessage: 'Lead excluído',
 *   trackEvent: 'core_delete',
 *   trackSource: 'leads',
 *   trackEntityType: 'lead',
 * })
 *
 * await deleteMutation.mutate(undefined, leadId)
 */
export function useMutation<TItem extends { id: string }, TResult = TItem>(
  setItems: React.Dispatch<React.SetStateAction<TItem[]>>,
  options: MutationOptions<TItem, TResult>
): MutationResult {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rollbackRef = useRef<TItem[] | null>(null)

  const mutate = useCallback(
    async (payload?: unknown, id?: string): Promise<boolean> => {
      setIsMutating(true)
      setError(null)

      // 1. Snapshot current state and apply optimistic update
      if (options.optimisticUpdate) {
        setItems((prev) => {
          rollbackRef.current = prev
          return options.optimisticUpdate!(prev, payload, id)
        })
      } else {
        // Snapshot without optimistic update
        setItems((prev) => {
          rollbackRef.current = prev
          return prev
        })
      }

      try {
        // 2. Execute API call
        const path =
          typeof options.path === 'function' ? options.path(id!) : options.path

        let result: TResult
        if (options.method === 'DELETE') {
          await apiRequest(path, { method: 'DELETE' })
          result = undefined as unknown as TResult
        } else {
          result = await apiRequest<TResult>(path, {
            method: options.method,
            body: payload,
          })
        }

        // 3. Reconcile with server response (if handler provided)
        if (options.onSuccess) {
          setItems((prev) => options.onSuccess!(prev, result, id))
        }

        // 4. Toast
        if (options.successMessage) {
          const toastType = options.method === 'DELETE' ? 'info' : 'success'
          toast(options.successMessage, toastType as 'success' | 'info')
        }

        // 5. Track analytics
        if (options.trackEvent) {
          track(options.trackEvent, {
            source: options.trackSource ?? 'web',
            entity_type: options.trackEntityType ?? 'unknown',
            entity_id:
              id ?? (result as unknown as { id?: string })?.id ?? null,
            outcome: 'success',
          }).catch(() => undefined)
        }

        rollbackRef.current = null
        return true
      } catch (err) {
        // 6. Rollback optimistic update
        if (rollbackRef.current) {
          setItems(rollbackRef.current)
          rollbackRef.current = null
        }

        // 7. Error toast
        const message =
          err instanceof Error
            ? err.message
            : options.errorMessage || 'Erro ao executar operação'
        setError(message)
        toast(message, 'error')
        return false
      } finally {
        setIsMutating(false)

        // 8. Settle callback (e.g., pagination refresh)
        if (options.onSettled) {
          try {
            await options.onSettled()
          } catch {
            // settle errors are non-critical
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setItems]
  )

  return { mutate, isMutating, error }
}
