import { z } from 'zod'

const sopStatusSchema = z.enum(['draft', 'published', 'archived'])
const sopBlockTypeSchema = z.enum(['title', 'text', 'image'])

export const sopBlockSchema = z.object({
  id: z.string().trim().min(1, 'Bloco sem id'),
  type: sopBlockTypeSchema,
  content: z.string().trim().min(1, 'Conteúdo obrigatório').max(300000, 'Conteúdo muito longo'),
})

export const sopBrandingSchema = z.object({
  company_name: z.string().trim().max(140).nullable().optional(),
  company_document: z.string().trim().max(40).nullable().optional(),
  responsible_name: z.string().trim().max(140).nullable().optional(),
  logo_url: z.string().url('Logo inválida').nullable().optional(),
})

export const createSopSchema = z.object({
  obra_id: z.string().uuid().nullable().optional(),
  projeto_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3, 'Título muito curto').max(160, 'Título muito longo'),
  description: z.string().trim().max(4000).nullable().optional(),
  status: sopStatusSchema.optional().default('draft'),
  blocks: z.array(sopBlockSchema).max(120, 'Máximo de 120 blocos').default([]),
  branding: sopBrandingSchema.optional().default({}),
})

export const updateSopSchema = z
  .object({
    obra_id: z.string().uuid().nullable().optional(),
    projeto_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    status: sopStatusSchema.optional(),
    blocks: z.array(sopBlockSchema).max(120).optional(),
    branding: sopBrandingSchema.optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: 'Payload vazio',
  })

export const shareSopWhatsAppSchema = z.object({
  to: z.string().trim().min(8, 'Telefone inválido').max(32, 'Telefone inválido'),
  message: z.string().trim().max(1200).nullable().optional(),
})

export const sendSopEmailSchema = z.object({
  to: z.string().email('E-mail inválido'),
  subject: z.string().trim().min(3, 'Assunto inválido').max(180).optional(),
  message: z.string().trim().max(1200).nullable().optional(),
})

export type CreateSopDTO = z.infer<typeof createSopSchema>
export type UpdateSopDTO = z.infer<typeof updateSopSchema>
export type ShareSopWhatsAppDTO = z.infer<typeof shareSopWhatsAppSchema>
export type SendSopEmailDTO = z.infer<typeof sendSopEmailSchema>
