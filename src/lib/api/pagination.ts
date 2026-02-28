const DEFAULT_PAGE = 1

export interface PaginationInput {
  page: number
  pageSize: number
  offset: number
}

export interface PaginationMeta extends Record<string, unknown> {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

function asPositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function getPaginationFromSearchParams(
  searchParams: URLSearchParams,
  options?: { defaultPageSize?: number; maxPageSize?: number }
): PaginationInput {
  const defaultPageSize = options?.defaultPageSize ?? 50
  const maxPageSize = options?.maxPageSize ?? 100

  const page = asPositiveInt(searchParams.get('page'), DEFAULT_PAGE)
  const rawPageSize = asPositiveInt(
    searchParams.get('pageSize') || searchParams.get('limit'),
    defaultPageSize
  )
  const pageSize = Math.max(1, Math.min(rawPageSize, maxPageSize))
  const offset = (page - 1) * pageSize

  return { page, pageSize, offset }
}

export function buildPaginationMeta(
  dataLength: number,
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  return {
    count: dataLength,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  }
}
