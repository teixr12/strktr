import { z } from 'zod'

export const emailTriageSourceSchema = z.enum(['manual', 'forwarded', 'integration'])
export const emailTriageClassificationSchema = z.enum([
  'lead',
  'supplier',
  'client',
  'operations',
  'spam',
  'unknown',
])
export const emailTriageStatusSchema = z.enum(['new', 'reviewing', 'qualified', 'ignored', 'archived'])

const optionalStringSchema = z.string().trim().optional().nullable()

export const createEmailTriageItemSchema = z.object({
  source: emailTriageSourceSchema.default('manual'),
  sender_name: optionalStringSchema,
  sender_email: z.string().trim().email('Email inválido'),
  subject: z.string().trim().min(2, 'Assunto é obrigatório'),
  snippet: optionalStringSchema,
  classification: emailTriageClassificationSchema.default('unknown'),
  status: emailTriageStatusSchema.default('new'),
  lead_id: optionalStringSchema,
  received_at: z.string().trim().min(1, 'Data de recebimento é obrigatória'),
  notes: optionalStringSchema,
})

export type CreateEmailTriageItemDTO = z.infer<typeof createEmailTriageItemSchema>

export const updateEmailTriageItemSchema = createEmailTriageItemSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateEmailTriageItemDTO = z.infer<typeof updateEmailTriageItemSchema>
