import { z } from 'zod'

const billingProviderSchema = z.enum(['stripe', 'mercadopago'])
const billingPlanStatusSchema = z.enum(['draft', 'active', 'archived'])
const billingProviderRolloutModeSchema = z.enum(['internal', 'allowlist', 'closed_beta', 'general_blocked'])
const billingProviderOperationalStatusSchema = z.enum(['planned', 'sandbox_ready', 'beta_ready', 'live_blocked'])
const billingSubscriptionLaunchModeSchema = z.enum(['internal_preview', 'allowlist_beta', 'general_blocked'])
const billingKycStatusSchema = z.enum(['not_started', 'in_progress', 'ready'])
const billingSubscriptionStatusSchema = z.enum(['inactive', 'sandbox', 'trialing', 'active', 'past_due', 'paused', 'canceled'])
const billingSubscriptionEventTypeSchema = z.enum([
  'note',
  'status_changed',
  'trial_started',
  'trial_ended',
  'renewal_scheduled',
  'renewed',
  'payment_failed',
  'paused',
  'resumed',
  'canceled',
  'manual_override',
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

const optionalNullableMoney = z
  .union([z.number().int().min(0), z.null()])
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

const optionalNullableDatetime = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Data inválida')
  .optional()

const billingProviderArraySchema = z.array(billingProviderSchema).min(1).max(2)

export const billingAdminSettingsPatchSchema = z
  .object({
    default_provider: billingProviderSchema.optional(),
    billing_email: optionalNullableEmail,
    support_email: optionalNullableEmail,
    terms_url: optionalNullableUrl,
    privacy_url: optionalNullableUrl,
    checkout_enabled: z.boolean().optional(),
    sandbox_mode: z.boolean().optional(),
    trial_days: z.number().int().min(0).max(90).optional(),
    monthly_price_cents: optionalNullableMoney,
    annual_price_cents: optionalNullableMoney,
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const billingCheckoutDraftPatchSchema = z
  .object({
    plan_slug: z.string().trim().min(2).max(64).optional(),
    headline: optionalNullableText(140),
    subheadline: optionalNullableText(280),
    currency: z.string().trim().length(3).optional(),
    monthly_price_cents: optionalNullableMoney,
    annual_price_cents: optionalNullableMoney,
    trial_days_override: z.union([z.number().int().min(0).max(90), z.null()]).optional(),
    primary_cta_label: optionalNullableText(80),
    accepted_providers: billingProviderArraySchema.optional(),
    feature_bullets: z.array(z.string().trim().min(2).max(120)).max(8).optional(),
    mode: z.enum(['disabled', 'sandbox']).optional(),
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type BillingAdminSettingsPatchDTO = z.infer<typeof billingAdminSettingsPatchSchema>
export type BillingCheckoutDraftPatchDTO = z.infer<typeof billingCheckoutDraftPatchSchema>

export const billingPlanCatalogCreateSchema = z.object({
  slug: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  description: optionalNullableText(280),
  status: billingPlanStatusSchema.default('draft'),
  currency: z.string().trim().length(3).default('BRL'),
  monthly_price_cents: optionalNullableMoney,
  annual_price_cents: optionalNullableMoney,
  trial_days: z.number().int().min(0).max(90).default(14),
  accepted_providers: billingProviderArraySchema,
  feature_bullets: z.array(z.string().trim().min(2).max(120)).max(8).default([]),
  featured: z.boolean().default(false),
  notes: optionalNullableText(1000),
})

export const billingPlanCatalogPatchSchema = z
  .object({
    slug: z.string().trim().min(2).max(64).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    description: optionalNullableText(280),
    status: billingPlanStatusSchema.optional(),
    currency: z.string().trim().length(3).optional(),
    monthly_price_cents: optionalNullableMoney,
    annual_price_cents: optionalNullableMoney,
    trial_days: z.number().int().min(0).max(90).optional(),
    accepted_providers: billingProviderArraySchema.optional(),
    feature_bullets: z.array(z.string().trim().min(2).max(120)).max(8).optional(),
    featured: z.boolean().optional(),
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const billingProviderSettingsPatchSchema = z
  .object({
    provider_code: billingProviderSchema,
    operational_status: billingProviderOperationalStatusSchema.optional(),
    rollout_mode: billingProviderRolloutModeSchema.optional(),
    account_reference: optionalNullableText(120),
    publishable_key_hint: optionalNullableText(80),
    webhook_endpoint_hint: optionalNullableUrl,
    settlement_country: optionalNullableText(64),
    accepted_currencies: z.array(z.string().trim().length(3)).max(6).optional(),
    supports_pix: z.boolean().optional(),
    supports_cards: z.boolean().optional(),
    notes: optionalNullableText(1000),
  })
  .refine(
    (payload) =>
      Object.entries(payload).some(([key, value]) => key !== 'provider_code' && value !== undefined),
    {
      message: 'Payload vazio',
    }
  )

export type BillingPlanCatalogCreateDTO = z.infer<typeof billingPlanCatalogCreateSchema>
export type BillingPlanCatalogPatchDTO = z.infer<typeof billingPlanCatalogPatchSchema>
export type BillingProviderSettingsPatchDTO = z.infer<typeof billingProviderSettingsPatchSchema>

export const billingSubscriptionReadinessPatchSchema = z
  .object({
    selected_plan_slug: optionalNullableText(64),
    preferred_provider: billingProviderSchema.optional(),
    billing_contact_name: optionalNullableText(120),
    billing_contact_email: optionalNullableEmail,
    finance_owner_name: optionalNullableText(120),
    finance_owner_email: optionalNullableEmail,
    company_legal_name: optionalNullableText(160),
    company_address: optionalNullableText(240),
    launch_mode: billingSubscriptionLaunchModeSchema.optional(),
    kyc_status: billingKycStatusSchema.optional(),
    terms_accepted: z.boolean().optional(),
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type BillingSubscriptionReadinessPatchDTO = z.infer<typeof billingSubscriptionReadinessPatchSchema>

export const billingSubscriptionStatePatchSchema = z
  .object({
    status: billingSubscriptionStatusSchema.optional(),
    provider_code: billingProviderSchema.optional(),
    plan_slug: optionalNullableText(64),
    external_customer_ref: optionalNullableText(120),
    external_subscription_ref: optionalNullableText(120),
    current_period_start_at: optionalNullableDatetime,
    current_period_end_at: optionalNullableDatetime,
    trial_ends_at: optionalNullableDatetime,
    cancel_at_period_end: z.boolean().optional(),
    auto_renew: z.boolean().optional(),
    launched_at: optionalNullableDatetime,
    last_synced_at: optionalNullableDatetime,
    notes: optionalNullableText(1000),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type BillingSubscriptionStatePatchDTO = z.infer<typeof billingSubscriptionStatePatchSchema>

export const billingSubscriptionEventCreateSchema = z.object({
  event_type: billingSubscriptionEventTypeSchema,
  actor_label: optionalNullableText(120),
  summary: z.string().trim().min(3).max(180),
  details: optionalNullableText(1000),
  status_before: z.union([billingSubscriptionStatusSchema, z.null()]).optional(),
  status_after: z.union([billingSubscriptionStatusSchema, z.null()]).optional(),
  provider_code: z.union([billingProviderSchema, z.null()]).optional(),
  effective_at: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida'),
})

export type BillingSubscriptionEventCreateDTO = z.infer<typeof billingSubscriptionEventCreateSchema>
