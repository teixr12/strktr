import { z } from 'zod'

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const cronogramaItemTipoSchema = z.enum(['tarefa', 'marco'])
export const cronogramaItemStatusSchema = z.enum([
  'pendente',
  'em_andamento',
  'concluido',
  'bloqueado',
])
export const cronogramaDependenciaTipoSchema = z.enum(['FS', 'SS', 'FF'])

export const createCronogramaItemSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do item é obrigatório'),
  descricao: z.string().trim().optional().nullable(),
  tipo: cronogramaItemTipoSchema.default('tarefa'),
  status: cronogramaItemStatusSchema.default('pendente'),
  empresa_responsavel: z.string().trim().optional().nullable(),
  responsavel: z.string().trim().optional().nullable(),
  data_inicio_planejada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  data_fim_planejada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  duracao_dias: z.number().int().positive().default(1),
  ordem: z.number().int().nonnegative().optional(),
  progresso: z.number().int().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateCronogramaItemDTO = z.infer<typeof createCronogramaItemSchema>

export const updateCronogramaItemSchema = createCronogramaItemSchema
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Payload vazio',
  })

export type UpdateCronogramaItemDTO = z.infer<typeof updateCronogramaItemSchema>

export const createCronogramaDependenciaSchema = z.object({
  predecessor_item_id: z.string().uuid(),
  successor_item_id: z.string().uuid(),
  tipo: cronogramaDependenciaTipoSchema.default('FS'),
  lag_dias: z.number().int().default(0),
})

export type CreateCronogramaDependenciaDTO = z.infer<typeof createCronogramaDependenciaSchema>

export const cronogramaCalendarioSchema = z.object({
  dias_uteis: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Informe ao menos um dia útil')
    .default([1, 2, 3, 4, 5]),
  feriados: z.array(isoDateSchema).optional().default([]),
})

export type CronogramaCalendarioDTO = z.infer<typeof cronogramaCalendarioSchema>

export const updateCronogramaSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  calendario: cronogramaCalendarioSchema.optional(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Payload vazio',
})

export type UpdateCronogramaDTO = z.infer<typeof updateCronogramaSchema>

export const generateCronogramaPdfSchema = z.object({
  includeBaseline: z.boolean().optional().default(false),
  sendEmailTo: z.string().email().optional().nullable(),
})

export type GenerateCronogramaPdfDTO = z.infer<typeof generateCronogramaPdfSchema>

export const inviteClientPortalSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do cliente é obrigatório'),
  email: z.string().email('Email inválido'),
  telefone: z.string().trim().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(90).default(30),
})

export type InviteClientPortalDTO = z.infer<typeof inviteClientPortalSchema>

export const approveDecisionSchema = z.object({
  token: z.string().min(20, 'Token inválido'),
  comentario: z.string().trim().optional().nullable(),
})

export type ApproveDecisionDTO = z.infer<typeof approveDecisionSchema>

export const rejectDecisionSchema = z.object({
  token: z.string().min(20, 'Token inválido'),
  comentario: z.string().trim().min(2, 'Comentário é obrigatório para reprovação'),
})

export type RejectDecisionDTO = z.infer<typeof rejectDecisionSchema>

export const createPortalCommentSchema = z.object({
  token: z.string().min(20, 'Token inválido'),
  mensagem: z.string().trim().min(2, 'Mensagem é obrigatória'),
  aprovacao_id: z.string().uuid().optional().nullable(),
})

export type CreatePortalCommentDTO = z.infer<typeof createPortalCommentSchema>
