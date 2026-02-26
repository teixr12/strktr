import { z } from 'zod'

const dateStringOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .or(z.null())

export const etapaStatusSchema = z.enum(['Pendente', 'Em Andamento', 'Concluída', 'Bloqueada'])

export const updateEtapaStatusSchema = z.object({
  status: etapaStatusSchema,
})

export type UpdateEtapaStatusDTO = z.infer<typeof updateEtapaStatusSchema>

export const createDiarioNoteSchema = z.object({
  titulo: z.string().trim().min(3, 'Título deve ter ao menos 3 caracteres'),
  descricao: z.string().trim().min(3, 'Descrição deve ter ao menos 3 caracteres'),
})

export type CreateDiarioNoteDTO = z.infer<typeof createDiarioNoteSchema>

export const createEtapaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da etapa é obrigatório'),
  responsavel: z.string().trim().optional().nullable(),
  status: etapaStatusSchema,
})

export type CreateEtapaDTO = z.infer<typeof createEtapaSchema>

export const createChecklistSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do checklist é obrigatório'),
  tipo: z.enum(['pre_obra', 'pos_obra', 'custom']),
})

export type CreateChecklistDTO = z.infer<typeof createChecklistSchema>

export const createChecklistItemSchema = z.object({
  descricao: z.string().trim().min(2, 'Descrição do item é obrigatória'),
  data_limite: dateStringOrNull.optional(),
})

export type CreateChecklistItemDTO = z.infer<typeof createChecklistItemSchema>

export const updateChecklistItemSchema = z
  .object({
    descricao: z.string().trim().min(2, 'Descrição deve ter ao menos 2 caracteres').optional(),
    data_limite: dateStringOrNull.optional(),
  })
  .refine((payload) => payload.descricao !== undefined || payload.data_limite !== undefined, {
    message: 'Payload vazio',
  })

export type UpdateChecklistItemDTO = z.infer<typeof updateChecklistItemSchema>

export const obraFormSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da obra é obrigatório'),
  cliente: z.string().trim().min(2, 'Cliente é obrigatório'),
  local: z.string().trim().min(2, 'Local é obrigatório'),
  tipo: z.string().trim().min(2),
  valor_contrato: z.number().nonnegative(),
  area_m2: z.number().nonnegative().optional().nullable(),
  progresso: z.number().min(0).max(100),
  status: z.enum(['Em Andamento', 'Concluída', 'Pausada', 'Cancelada', 'Orçamento']),
  etapa_atual: z.string().trim().optional().nullable(),
  data_inicio: dateStringOrNull.optional(),
  data_previsao: dateStringOrNull.optional(),
  descricao: z.string().trim().optional().nullable(),
})

export type ObraFormDTO = z.infer<typeof obraFormSchema>
