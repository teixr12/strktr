import type { SupabaseClient } from '@supabase/supabase-js'

export type SortDirection = 'asc' | 'desc'

export type ListQueryPolicy = {
  defaultPageSize: number
  maxPageSize: number
  defaultSort?: string
  allowedSorts?: readonly string[]
  defaultDirection?: SortDirection
}

export type ResolvedListQuery = {
  page: number
  pageSize: number
  offset: number
  sort: string | null
  direction: SortDirection
}

export type SelectMap = Record<string, readonly string[]>

export function createSelectMap(map: SelectMap): SelectMap {
  return Object.freeze({ ...map })
}

export function resolveSelectProjection(
  map: SelectMap,
  key: string,
  fallback: readonly string[]
): string {
  const columns = map[key] || fallback
  return columns.join(', ')
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveListQuery(
  searchParams: URLSearchParams,
  policy: ListQueryPolicy
): ResolvedListQuery {
  const requestedPage = Number(searchParams.get('page') || 1)
  const requestedPageSize = Number(searchParams.get('pageSize') || policy.defaultPageSize)
  const page = Number.isFinite(requestedPage) ? clamp(Math.trunc(requestedPage), 1, 10_000) : 1
  const pageSize = Number.isFinite(requestedPageSize)
    ? clamp(Math.trunc(requestedPageSize), 1, policy.maxPageSize)
    : policy.defaultPageSize

  const requestedSort = (searchParams.get('sort') || policy.defaultSort || '').trim()
  const sort =
    requestedSort.length > 0 &&
    (!policy.allowedSorts || policy.allowedSorts.includes(requestedSort))
      ? requestedSort
      : (policy.defaultSort || null)

  const directionRaw = (searchParams.get('direction') || policy.defaultDirection || 'desc')
    .trim()
    .toLowerCase()
  const direction: SortDirection = directionRaw === 'asc' ? 'asc' : 'desc'

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    sort,
    direction,
  }
}

export function tenantQuery<TTable extends string>(
  supabase: SupabaseClient,
  table: TTable,
  orgId: string
) {
  if (!orgId) throw new Error('tenantQuery requires orgId')
  type TenantScopedQuery = {
    eq: (column: string, value: unknown) => unknown
  }
  type TenantScopedClient = {
    from: (relation: string) => TenantScopedQuery
  }

  // Supabase table typing for dynamic domains is intentionally relaxed at this boundary.
  const tenantClient = supabase as unknown as TenantScopedClient
  return tenantClient.from(table).eq('org_id', orgId)
}
