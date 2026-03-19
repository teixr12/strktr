export type SupplierStatus = 'active' | 'watchlist' | 'blocked'

export interface SupplierRecord {
  id: string
  org_id: string
  nome: string
  documento: string | null
  email: string | null
  telefone: string | null
  cidade: string | null
  estado: string | null
  status: SupplierStatus
  score_manual: number
  notas: string | null
  created_at: string
  updated_at: string
}

export interface SupplierSummary {
  total: number
  active: number
  watchlist: number
  blocked: number
  averageScore: number
}
