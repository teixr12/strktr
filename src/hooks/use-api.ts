'use client'

import useSWR, { type SWRConfiguration, type KeyedMutator } from 'swr'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'

type ApiEnvelope<T, M = Record<string, unknown>> = {
  data: T
  meta?: M
  requestId?: string
}

/**
 * SWR-powered data fetching hook that wraps `apiRequest`.
 * Provides automatic caching, deduplication, and revalidation.
 *
 * Pass `null` as path to conditionally skip fetching.
 *
 * @example
 * const { data, error, isLoading, mutate } = useApi<Lead[]>('/api/v1/leads')
 */
export function useApi<T>(
  path: string | null,
  config?: SWRConfiguration<T>
): {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  mutate: KeyedMutator<T>
} {
  const result = useSWR<T, Error>(
    path,
    (url: string) => apiRequest<T>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
      errorRetryCount: 2,
      ...config,
    }
  )

  return {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    isValidating: result.isValidating,
    mutate: result.mutate,
  }
}

/**
 * SWR-powered hook that returns the full API envelope (data + meta).
 * Useful for paginated endpoints that need count/page info.
 *
 * @example
 * const { data, error } = useApiWithMeta<Lead[], PaginationMeta>('/api/v1/leads?page=1')
 */
export function useApiWithMeta<T, M = Record<string, unknown>>(
  path: string | null,
  config?: SWRConfiguration<ApiEnvelope<T, M>>
): {
  data: ApiEnvelope<T, M> | undefined
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  mutate: KeyedMutator<ApiEnvelope<T, M>>
} {
  const result = useSWR<ApiEnvelope<T, M>, Error>(
    path ? `__meta__${path}` : null,
    () => apiRequestWithMeta<T, M>(path!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
      errorRetryCount: 2,
      ...config,
    }
  )

  return {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    isValidating: result.isValidating,
    mutate: result.mutate,
  }
}
