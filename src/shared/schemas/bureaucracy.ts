import { z } from 'zod'

export const bureaucracyCategorySchema = z.enum([
  'prefeitura',
  'condominio',
  'judicial',
  'extrajudicial',
  'cartorio',
  'documentacao',
  'licenciamento',
  'outro',
])

export const bureaucracyStatusSchema = z.enum([
  'draft',
  'pending',
  'in_review',
  'waiting_external',
  'scheduled',
  'resolved',
  'archived',
])

export const bureaucracyPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

const optionalDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
  .optional()
  .nullable()

const optionalStringSchema = z.string().trim().optional().nullable()

export const createBureaucracyItemSchema = z.object({
  titulo: z.string().trim().min(2, 'Título é obrigatório'),
  categoria: bureaucracyCategorySchema.default('prefeitura'),
  status: bureaucracyStatusSchema.default('pending'),
  prioridade: bureaucracyPrioritySchema.default('medium'),
  obra_id: optionalStringSchema,
  projeto_id: optionalStringSchema,
  processo_codigo: optionalStringSchema,
  orgao_nome: optionalStringSchema,
  responsavel_nome: optionalStringSchema,
  responsavel_email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  proxima_acao: optionalStringSchema,
  proxima_checagem_em: optionalDateSchema,
  reuniao_em: optionalStringSchema,
  link_externo: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
  descricao: optionalStringSchema,
})

export type CreateBureaucracyItemDTO = z.infer<typeof createBureaucracyItemSchema>

export const updateBureaucracyItemSchema = createBureaucracyItemSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateBureaucracyItemDTO = z.infer<typeof updateBureaucracyItemSchema>
