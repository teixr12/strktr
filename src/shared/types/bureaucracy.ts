export type BureaucracyCategory =
  | 'prefeitura'
  | 'condominio'
  | 'judicial'
  | 'extrajudicial'
  | 'cartorio'
  | 'documentacao'
  | 'licenciamento'
  | 'outro'

export type BureaucracyStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'waiting_external'
  | 'scheduled'
  | 'resolved'
  | 'archived'

export type BureaucracyPriority = 'low' | 'medium' | 'high' | 'critical'

export interface BureaucracyRecord {
  id: string
  org_id: string
  titulo: string
  categoria: BureaucracyCategory
  status: BureaucracyStatus
  prioridade: BureaucracyPriority
  obra_id: string | null
  obra_nome: string | null
  projeto_id: string | null
  projeto_nome: string | null
  processo_codigo: string | null
  orgao_nome: string | null
  responsavel_nome: string | null
  responsavel_email: string | null
  proxima_acao: string | null
  proxima_checagem_em: string | null
  reuniao_em: string | null
  link_externo: string | null
  descricao: string | null
  created_at: string
  updated_at: string
  ultima_atualizacao_em: string
}

export interface BureaucracySummary {
  total: number
  open: number
  urgent: number
  overdue: number
  waitingExternal: number
  resolved: number
}

export interface BureaucracyContextOption {
  id: string
  nome: string
}
