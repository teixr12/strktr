import { z } from 'zod'

const scopeCodesSchema = z.array(z.string().trim().min(3).max(64)).max(12)
const publicApiClientExposureSchema = z.enum(['internal_only', 'allowlist', 'beta', 'general_blocked'])
const publicApiClientTokenStatusSchema = z.enum(['active', 'revoked'])
const optionalNullableQuotaNumber = (min: number, max: number) =>
  z.union([z.number().int().min(min).max(max), z.null()]).optional()

const optionalNullableText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    })
    .refine((value) => !value || value.length <= max, `Máximo de ${max} caracteres`)
    .optional()

const optionalNullableEmail = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine((value) => !value || z.string().email().safeParse(value).success, 'Email inválido')
  .optional()

export const publicApiClientCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nome é obrigatório').max(120, 'Máximo de 120 caracteres'),
  exposure: publicApiClientExposureSchema.default('internal_only'),
  scope_codes: scopeCodesSchema.min(1, 'Selecione pelo menos um scope'),
  rate_limit_per_minute: z.number().int().min(10).max(10000).default(120),
  daily_quota: z.number().int().min(100).max(10000000).default(10000),
  monthly_call_budget: z.number().int().min(1000).max(100000000).default(250000),
  owner_email: optionalNullableEmail,
  notes: optionalNullableText(1000),
}).refine((payload) => payload.monthly_call_budget >= payload.daily_quota, {
  message: 'O budget mensal precisa ser maior ou igual à quota diária',
  path: ['monthly_call_budget'],
})

export const publicApiClientPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    status: z.enum(['draft', 'active', 'revoked']).optional(),
    exposure: publicApiClientExposureSchema.optional(),
    scope_codes: scopeCodesSchema.optional(),
    rate_limit_per_minute: z.number().int().min(10).max(10000).optional(),
    daily_quota: z.number().int().min(100).max(10000000).optional(),
    monthly_call_budget: z.number().int().min(1000).max(100000000).optional(),
    owner_email: optionalNullableEmail,
    notes: optionalNullableText(1000),
  })
  .refine(
    (payload) =>
      payload.daily_quota === undefined ||
      payload.monthly_call_budget === undefined ||
      payload.monthly_call_budget >= payload.daily_quota,
    {
      message: 'O budget mensal precisa ser maior ou igual à quota diária',
      path: ['monthly_call_budget'],
    }
  )
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type PublicApiClientCreateDTO = z.infer<typeof publicApiClientCreateSchema>
export type PublicApiClientPatchDTO = z.infer<typeof publicApiClientPatchSchema>

const optionalNullableIsoDate = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine(
    (value) => !value || !Number.isNaN(Date.parse(value)),
    'Data inválida'
  )
  .optional()

export const publicApiClientTokenCreateSchema = z.object({
  label: z.string().trim().min(2, 'Nome do token é obrigatório').max(120, 'Máximo de 120 caracteres'),
  exposure: publicApiClientExposureSchema.default('internal_only'),
  rate_limit_per_minute_override: optionalNullableQuotaNumber(1, 10000),
  daily_quota_override: optionalNullableQuotaNumber(1, 10000000),
  monthly_call_budget_override: optionalNullableQuotaNumber(1, 100000000),
  expires_at: optionalNullableIsoDate,
  notes: optionalNullableText(1000),
})

export const publicApiClientTokenPatchSchema = z
  .object({
    status: publicApiClientTokenStatusSchema.optional(),
    exposure: publicApiClientExposureSchema.optional(),
    rate_limit_per_minute_override: optionalNullableQuotaNumber(1, 10000),
    daily_quota_override: optionalNullableQuotaNumber(1, 10000000),
    monthly_call_budget_override: optionalNullableQuotaNumber(1, 100000000),
    expires_at: optionalNullableIsoDate,
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type PublicApiClientTokenCreateDTO = z.infer<typeof publicApiClientTokenCreateSchema>
export type PublicApiClientTokenPatchDTO = z.infer<typeof publicApiClientTokenPatchSchema>

export const publicApiClientTokenBlockPreviewSchema = z.object({
  endpoint_family: z
    .string()
    .trim()
    .min(2, 'Endpoint family é obrigatório')
    .max(120, 'Máximo de 120 caracteres'),
  call_count: z.number().int().min(1, 'Use pelo menos 1 chamada').max(1000, 'Máximo de 1000 chamadas'),
})

export type PublicApiClientTokenBlockPreviewDTO = z.infer<typeof publicApiClientTokenBlockPreviewSchema>
