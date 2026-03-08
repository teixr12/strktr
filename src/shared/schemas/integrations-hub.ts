import { z } from 'zod'

const providerCodeSchema = z.enum([
  'whatsapp_business',
  'google_calendar',
  'resend',
  'posthog',
  'stripe',
  'mercadopago',
  'notion',
  'slack',
  'google_sheets',
  'webhooks',
  'sicoob_api',
])

const optionalNullableEmail = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Email inválido')
  .optional()

const optionalNullableUrl = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine((value) => !value || /^https?:\/\/.+/i.test(value), 'URL inválida')
  .optional()

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

export const integrationHubSettingsPatchSchema = z.object({
  provider_code: providerCodeSchema,
  enabled: z.boolean().optional(),
  status: z.enum(['draft', 'configured', 'blocked']).optional(),
  rollout_mode: z.enum(['disabled', 'sandbox', 'beta', 'live']).optional(),
  owner_email: optionalNullableEmail,
  callback_url: optionalNullableUrl,
  notes: optionalNullableText(1000),
}).refine((payload) => {
  return (
    payload.enabled !== undefined ||
    payload.status !== undefined ||
    payload.rollout_mode !== undefined ||
    payload.owner_email !== undefined ||
    payload.callback_url !== undefined ||
    payload.notes !== undefined
  )
}, {
  message: 'Payload vazio',
})

export type IntegrationHubSettingsPatchDTO = z.infer<typeof integrationHubSettingsPatchSchema>
