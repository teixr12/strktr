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
