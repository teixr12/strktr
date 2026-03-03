import { z } from 'zod'

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Cor inválida (use formato hexadecimal)')

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

const optionalNullableUrl = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })
  .refine(
    (value) => !value || /^https?:\/\/.+/i.test(value),
    'URL inválida'
  )
  .optional()

export const portalAdminSettingsPatchSchema = z
  .object({
    branding_nome: optionalNullableText(120),
    branding_logo_url: optionalNullableUrl,
    branding_cor_primaria: hexColorSchema.optional(),
    mensagem_boas_vindas: optionalNullableText(1000),
    notificar_por_email: z.boolean().optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export type PortalAdminSettingsPatchDTO = z.infer<typeof portalAdminSettingsPatchSchema>

export const portalAdminRegenerateInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(90).default(30),
})

export type PortalAdminRegenerateInviteDTO = z.infer<typeof portalAdminRegenerateInviteSchema>
