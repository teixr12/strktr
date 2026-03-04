import { API_ERROR_CODES } from '@/lib/api/errors'

export const ApiErrorCatalog = {
  validation: API_ERROR_CODES.VALIDATION_ERROR,
  unauthorized: API_ERROR_CODES.UNAUTHORIZED,
  forbidden: API_ERROR_CODES.FORBIDDEN,
  notFound: API_ERROR_CODES.NOT_FOUND,
  conflict: API_ERROR_CODES.CONFLICT,
  db: API_ERROR_CODES.DB_ERROR,
  rateLimited: API_ERROR_CODES.RATE_LIMITED,
} as const

export type ApiErrorCatalogKey = keyof typeof ApiErrorCatalog
