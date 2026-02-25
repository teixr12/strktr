export interface Profile {
  id: string
  nome: string
  email: string | null
  avatar_url: string | null
  empresa: string | null
  cargo: string | null
  telefone: string | null
  created_at: string
  updated_at: string
}

export type ObraStatus = 'Em Andamento' | 'Concluída' | 'Pausada' | 'Cancelada' | 'Orçamento'

export interface Obra {
  id: string
  user_id: string
  nome: string
  cliente: string
  local: string
  tipo: string
  valor_contrato: number
  valor_gasto: number
  progresso: number
  status: ObraStatus
  etapa_atual: string | null
  area_m2: number | null
  data_inicio: string | null
  data_previsao: string | null
  data_conclusao: string | null
  descricao: string | null
  cor: string
  icone: string
  notas: string | null
  created_at: string
  updated_at: string
}

export type EtapaStatus = 'Pendente' | 'Em Andamento' | 'Concluída' | 'Bloqueada'

export interface ObraEtapa {
  id: string
  obra_id: string
  user_id: string
  nome: string
  descricao: string | null
  status: EtapaStatus
  ordem: number
  data_inicio: string | null
  data_fim: string | null
  responsavel: string | null
  created_at: string
}

export type LeadStatus = 'Novo' | 'Qualificado' | 'Proposta' | 'Negociação' | 'Fechado' | 'Perdido'
export type LeadTemperatura = 'Hot' | 'Morno' | 'Frio'

export interface Lead {
  id: string
  user_id: string
  nome: string
  email: string | null
  telefone: string | null
  empresa: string | null
  origem: string
  status: LeadStatus
  temperatura: LeadTemperatura
  valor_potencial: number | null
  tipo_projeto: string | null
  local: string | null
  notas: string | null
  ultimo_contato: string | null
  created_at: string
  updated_at: string
}

export type TransacaoTipo = 'Receita' | 'Despesa'
export type TransacaoStatus = 'Confirmado' | 'Pendente' | 'Cancelado'

export interface Transacao {
  id: string
  user_id: string
  obra_id: string | null
  tipo: TransacaoTipo
  categoria: string
  descricao: string
  valor: number
  data: string
  status: TransacaoStatus
  forma_pagto: string
  notas: string | null
  created_at: string
  obras?: { nome: string } | null
}

export type MembroStatus = 'Ativo' | 'Inativo' | 'Férias'

export interface Membro {
  id: string
  user_id: string
  nome: string
  cargo: string
  telefone: string | null
  email: string | null
  especialidade: string | null
  status: MembroStatus
  obras_ids: string[]
  avaliacao: number
  valor_hora: number | null
  notas: string | null
  avatar_url: string | null
  created_at: string
}

export type VisitaTipo = 'Visita' | 'Reunião' | 'Vistoria' | 'Entrega' | 'Outro'
export type VisitaStatus = 'Agendado' | 'Realizado' | 'Cancelado' | 'Reagendado'

export interface Visita {
  id: string
  user_id: string
  obra_id: string | null
  lead_id: string | null
  titulo: string
  descricao: string | null
  tipo: VisitaTipo
  data_hora: string
  duracao_min: number
  local: string | null
  status: VisitaStatus
  participantes: string[] | null
  notas: string | null
  created_at: string
  obras?: { nome: string } | null
  leads?: { nome: string } | null
}

export type OrcamentoStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Recusado'

export interface Orcamento {
  id: string
  user_id: string
  titulo: string
  lead_id: string | null
  obra_id: string | null
  status: OrcamentoStatus
  validade: string | null
  observacoes: string | null
  valor_total: number
  created_at: string
  updated_at: string
  orcamento_itens?: OrcamentoItem[]
}

export interface OrcamentoItem {
  id: string
  orcamento_id: string
  descricao: string
  unidade: string
  quantidade: number
  valor_unitario: number
  ordem: number
  created_at: string
}

// --- Fase 3: Diário de Obra, Checklists, Anexos ---

export type DiarioTipo = 'status_change' | 'etapa_change' | 'transacao' | 'checklist' | 'nota' | 'foto' | 'compra'

export interface DiarioObra {
  id: string
  obra_id: string
  user_id: string
  tipo: DiarioTipo
  titulo: string
  descricao: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type ChecklistTipo = 'pre_obra' | 'pos_obra' | 'custom'

export interface ObraChecklist {
  id: string
  obra_id: string
  user_id: string
  tipo: ChecklistTipo
  nome: string
  ordem: number
  created_at: string
  checklist_items?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  descricao: string
  concluido: boolean
  concluido_por: string | null
  concluido_em: string | null
  data_limite: string | null
  ordem: number
  created_at: string
}

export interface TransacaoAnexo {
  id: string
  transacao_id: string
  user_id: string
  url: string
  nome_arquivo: string
  tipo_arquivo: string
  tamanho_bytes: number | null
  created_at: string
}

// --- Fase 4: Projetos e Compras ---

export type ProjetoStatus = 'Planejamento' | 'Em Aprovação' | 'Aprovado' | 'Em Execução' | 'Concluído' | 'Arquivado'

export interface Projeto {
  id: string
  user_id: string
  nome: string
  descricao: string | null
  cliente: string | null
  local: string | null
  tipo: string
  status: ProjetoStatus
  valor_estimado: number
  area_m2: number | null
  lead_id: string | null
  obra_id: string | null
  data_inicio_prev: string | null
  data_fim_prev: string | null
  notas: string | null
  created_at: string
  updated_at: string
  leads?: { nome: string } | null
  obras?: { nome: string } | null
}

export type CompraStatus = 'Solicitado' | 'Aprovado' | 'Pedido' | 'Entregue' | 'Cancelado'
export type CompraUrgencia = 'Baixa' | 'Normal' | 'Alta' | 'Urgente'

export interface Compra {
  id: string
  user_id: string
  obra_id: string | null
  descricao: string
  categoria: string
  fornecedor: string | null
  valor_estimado: number
  valor_real: number | null
  status: CompraStatus
  urgencia: CompraUrgencia
  data_solicitacao: string
  data_aprovacao: string | null
  data_pedido: string | null
  data_entrega: string | null
  transacao_id: string | null
  notas: string | null
  created_at: string
  updated_at: string
  obras?: { nome: string } | null
}

// --- Fase 5: Organizações e Roles ---

export type UserRole = 'admin' | 'manager' | 'user'
export type OrgPlano = 'free' | 'pro' | 'enterprise'
export type OrgMembroStatus = 'ativo' | 'inativo' | 'pendente'

export interface Organizacao {
  id: string
  nome: string
  cnpj: string | null
  plano: OrgPlano
  created_at: string
  updated_at: string
}

export interface OrgMembro {
  id: string
  org_id: string
  user_id: string
  role: UserRole
  convidado_por: string | null
  status: OrgMembroStatus
  created_at: string
  organizacoes?: { nome: string; plano: OrgPlano } | null
  profiles?: { nome: string; email: string | null } | null
}

// --- Fase 6: Notificações e Webhooks ---

export type NotificacaoTipo = 'info' | 'warning' | 'success' | 'urgent'

export interface Notificacao {
  id: string
  user_id: string
  tipo: NotificacaoTipo
  titulo: string
  descricao: string | null
  lida: boolean
  link: string | null
  created_at: string
}

export interface Webhook {
  id: string
  user_id: string
  url: string
  eventos: string[]
  ativo: boolean
  secret: string | null
  created_at: string
}

// --- Fase 7: Knowledgebase ---

export type KBCategoria = 'material' | 'mao_de_obra' | 'equipamento' | 'sop' | 'referencia'

export interface KnowledgebaseItem {
  id: string
  user_id: string
  org_id: string | null
  categoria: KBCategoria
  titulo: string
  conteudo: string | null
  unidade: string | null
  valor_referencia: number | null
  tags: string[]
  ativo: boolean
  created_at: string
  updated_at: string
}
