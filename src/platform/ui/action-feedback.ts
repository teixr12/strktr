'use client'

import { useCallback, useMemo, useState } from 'react'

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error'

type RunActionOptions = {
  resetOnSuccessMs?: number
}

export function useActionFeedback(defaultResetOnSuccessMs = 1500) {
  const [status, setStatus] = useState<ActionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const run = useCallback(
    async <T>(action: () => Promise<T>, options?: RunActionOptions) => {
      setStatus('loading')
      setError(null)
      try {
        const result = await action()
        setStatus('success')
        const resetDelay = options?.resetOnSuccessMs ?? defaultResetOnSuccessMs
        if (resetDelay > 0) {
          setTimeout(() => {
            setStatus('idle')
          }, resetDelay)
        }
        return result
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Falha ao executar ação')
        throw err
      }
    },
    [defaultResetOnSuccessMs]
  )

  return useMemo(
    () => ({
      status,
      isIdle: status === 'idle',
      isLoading: status === 'loading',
      isSuccess: status === 'success',
      isError: status === 'error',
      error,
      run,
      reset,
    }),
    [status, error, run, reset]
  )
}
