import { z } from 'zod'

const dateStringOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .or(z.null())

export const leadStatusSchema = z.enum([
  'Novo',
  'Qualificado',
  'Proposta',
  'Negociação',
  'Fechado',
  'Perdido',
])

export const leadTemperaturaSchema = z.enum(['Hot', 'Morno', 'Frio'])

export const createLeadSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do lead é obrigatório'),
  email: z.string().email('Email inválido').optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  empresa: z.string().trim().optional().nullable(),
  origem: z.string().trim().min(2, 'Origem é obrigatória'),
  status: leadStatusSchema.default('Novo'),
  temperatura: leadTemperaturaSchema.default('Morno'),
  valor_potencial: z.number().nonnegative().optional().nullable(),
  tipo_projeto: z.string().trim().optional().nullable(),
  local: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
  ultimo_contato: z.string().datetime().optional().nullable(),
})

export type CreateLeadDTO = z.infer<typeof createLeadSchema>

export const updateLeadSchema = createLeadSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateLeadDTO = z.infer<typeof updateLeadSchema>

export const transacaoTipoSchema = z.enum(['Receita', 'Despesa'])
export const transacaoStatusSchema = z.enum(['Confirmado', 'Pendente', 'Cancelado'])

export const createTransacaoSchema = z.object({
  obra_id: z.string().uuid().optional().nullable(),
  tipo: transacaoTipoSchema,
  categoria: z.string().trim().min(2, 'Categoria é obrigatória'),
  descricao: z.string().trim().min(2, 'Descrição é obrigatória'),
  valor: z.number().positive('Valor deve ser maior que zero'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  status: transacaoStatusSchema.default('Confirmado'),
  forma_pagto: z.string().trim().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
})

export type CreateTransacaoDTO = z.infer<typeof createTransacaoSchema>

export const updateTransacaoSchema = createTransacaoSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateTransacaoDTO = z.infer<typeof updateTransacaoSchema>

export const compraStatusSchema = z.enum([
  'Solicitado',
  'Pendente Aprovação Cliente',
  'Revisão Cliente',
  'Aprovado',
  'Pedido',
  'Entregue',
  'Cancelado',
])
export const compraUrgenciaSchema = z.enum(['Baixa', 'Normal', 'Alta', 'Urgente'])

export const createCompraSchema = z.object({
  obra_id: z.string().uuid().optional().nullable(),
  descricao: z.string().trim().min(2, 'Descrição da compra é obrigatória'),
  categoria: z.string().trim().min(2, 'Categoria é obrigatória'),
  fornecedor: z.string().trim().optional().nullable(),
  valor_estimado: z.number().nonnegative().default(0),
  valor_real: z.number().nonnegative().optional().nullable(),
  status: compraStatusSchema.default('Solicitado'),
  urgencia: compraUrgenciaSchema.default('Normal'),
  exige_aprovacao_cliente: z.boolean().optional().default(false),
  reenviar_aprovacao_cliente: z.boolean().optional().default(false),
  data_solicitacao: dateStringOrNull.optional(),
  data_aprovacao: dateStringOrNull.optional(),
  data_pedido: dateStringOrNull.optional(),
  data_entrega: dateStringOrNull.optional(),
  notas: z.string().trim().optional().nullable(),
})

export type CreateCompraDTO = z.infer<typeof createCompraSchema>

export const updateCompraSchema = createCompraSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateCompraDTO = z.infer<typeof updateCompraSchema>

export const projetoStatusSchema = z.enum([
  'Planejamento',
  'Em Aprovação',
  'Aprovado',
  'Em Execução',
  'Concluído',
  'Arquivado',
])

export const createProjetoSchema = z.object({
  nome: z.string().trim().min(2, 'Nome do projeto é obrigatório'),
  descricao: z.string().trim().optional().nullable(),
  cliente: z.string().trim().optional().nullable(),
  local: z.string().trim().optional().nullable(),
  tipo: z.string().trim().min(2, 'Tipo é obrigatório'),
  status: projetoStatusSchema.default('Planejamento'),
  valor_estimado: z.number().nonnegative().default(0),
  area_m2: z.number().nonnegative().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  obra_id: z.string().uuid().optional().nullable(),
  data_inicio_prev: dateStringOrNull.optional(),
  data_fim_prev: dateStringOrNull.optional(),
  notas: z.string().trim().optional().nullable(),
})

export type CreateProjetoDTO = z.infer<typeof createProjetoSchema>

export const updateProjetoSchema = createProjetoSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateProjetoDTO = z.infer<typeof updateProjetoSchema>

export const orcamentoStatusSchema = z.enum([
  'Rascunho',
  'Enviado',
  'Pendente Aprovação Cliente',
  'Revisão Cliente',
  'Aprovado',
  'Recusado',
])

export const orcamentoItemSchema = z.object({
  descricao: z.string().trim().min(2, 'Descrição do item é obrigatória'),
  unidade: z.string().trim().min(1, 'Unidade é obrigatória'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  valor_unitario: z.number().nonnegative('Valor unitário não pode ser negativo'),
  ordem: z.number().int().nonnegative().optional(),
})

export const createOrcamentoSchema = z.object({
  titulo: z.string().trim().min(2, 'Título do orçamento é obrigatório'),
  lead_id: z.string().uuid().optional().nullable(),
  obra_id: z.string().uuid().optional().nullable(),
  status: orcamentoStatusSchema.default('Rascunho'),
  exige_aprovacao_cliente: z.boolean().optional().default(false),
  reenviar_aprovacao_cliente: z.boolean().optional().default(false),
  validade: dateStringOrNull.optional(),
  observacoes: z.string().trim().optional().nullable(),
  items: z.array(orcamentoItemSchema).min(1, 'Adicione pelo menos um item'),
})

export type CreateOrcamentoDTO = z.infer<typeof createOrcamentoSchema>

export const updateOrcamentoSchema = createOrcamentoSchema
  .omit({ items: true })
  .extend({
    items: z.array(orcamentoItemSchema).min(1, 'Adicione pelo menos um item').optional(),
  })
  .partial()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Payload vazio',
  })

export type UpdateOrcamentoDTO = z.infer<typeof updateOrcamentoSchema>

export const membroStatusSchema = z.enum(['Ativo', 'Inativo', 'Férias'])

export const createMembroSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  cargo: z.string().trim().min(2, 'Cargo é obrigatório'),
  telefone: z.string().trim().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  especialidade: z.string().trim().optional().nullable(),
  status: membroStatusSchema.default('Ativo'),
  avaliacao: z.number().min(0).max(5).default(5),
  valor_hora: z.number().nonnegative().optional().nullable(),
  notas: z.string().trim().optional().nullable(),
  avatar_url: z.string().url('Avatar inválido').optional().nullable(),
  obras_ids: z.array(z.string().uuid()).optional().default([]),
})

export type CreateMembroDTO = z.infer<typeof createMembroSchema>

export const updateMembroSchema = createMembroSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateMembroDTO = z.infer<typeof updateMembroSchema>

export const visitaTipoSchema = z.enum([
  'Visita',
  'Reunião',
  'Vistoria',
  'Entrega',
  'Outro',
])

export const visitaStatusSchema = z.enum([
  'Agendado',
  'Realizado',
  'Cancelado',
  'Reagendado',
])

export const createVisitaSchema = z.object({
  obra_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  titulo: z.string().trim().min(2, 'Título da visita é obrigatório'),
  descricao: z.string().trim().optional().nullable(),
  tipo: visitaTipoSchema.default('Visita'),
  data_hora: z.string().datetime('Data/hora inválida'),
  duracao_min: z.number().int().positive().default(60),
  local: z.string().trim().optional().nullable(),
  status: visitaStatusSchema.default('Agendado'),
  participantes: z.array(z.string().trim()).optional().nullable(),
  notas: z.string().trim().optional().nullable(),
})

export type CreateVisitaDTO = z.infer<typeof createVisitaSchema>

export const updateVisitaSchema = createVisitaSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateVisitaDTO = z.infer<typeof updateVisitaSchema>

export const kbCategoriaSchema = z.enum([
  'material',
  'mao_de_obra',
  'equipamento',
  'sop',
  'referencia',
])

export const createKnowledgeItemSchema = z.object({
  categoria: kbCategoriaSchema,
  titulo: z.string().trim().min(2, 'Título é obrigatório'),
  conteudo: z.string().trim().optional().nullable(),
  unidade: z.string().trim().optional().nullable(),
  valor_referencia: z.number().nonnegative().optional().nullable(),
  tags: z.array(z.string().trim()).default([]),
  ativo: z.boolean().optional().default(true),
})

export type CreateKnowledgeItemDTO = z.infer<typeof createKnowledgeItemSchema>

export const updateKnowledgeItemSchema = createKnowledgeItemSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  {
    message: 'Payload vazio',
  }
)

export type UpdateKnowledgeItemDTO = z.infer<typeof updateKnowledgeItemSchema>

export const updateProfileSchema = z
  .object({
    nome: z.string().trim().min(2, 'Nome é obrigatório').optional(),
    telefone: z.string().trim().optional().nullable(),
    empresa: z.string().trim().optional().nullable(),
    cargo: z.string().trim().optional().nullable(),
    avatar_url: z.string().url('Avatar inválido').optional().nullable(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Payload vazio',
  })

export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>

export const updatePasswordSchema = z.object({
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
})

export type UpdatePasswordDTO = z.infer<typeof updatePasswordSchema>

export const createOrgSchema = z.object({
  nome: z.string().trim().min(2, 'Nome da organização é obrigatório'),
  cnpj: z.string().trim().optional().nullable(),
})

export type CreateOrgDTO = z.infer<typeof createOrgSchema>

export const updateOrgSchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório').optional(),
  cnpj: z.string().trim().optional().nullable(),
}).refine((payload) => Object.keys(payload).length > 0, {
  message: 'Payload vazio',
})

export type UpdateOrgDTO = z.infer<typeof updateOrgSchema>

export const createOrgMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'manager', 'user']).default('user'),
})

export type CreateOrgMemberDTO = z.infer<typeof createOrgMemberSchema>

export const updateOrgMemberRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'user']),
})

export type UpdateOrgMemberRoleDTO = z.infer<typeof updateOrgMemberRoleSchema>
