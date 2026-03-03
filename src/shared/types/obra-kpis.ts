import type { ExecutionSeverity } from '@/shared/types/execution'

export interface ObraKpisPayload {
  obra: {
    id: string
    nome: string
    cliente: string
    status: string
    progresso: number
    data_previsao: string | null
  }
  kpis: {
    etapasTotal: number
    etapasConcluidas: number
    etapasBloqueadas: number
    checklistTotal: number
    checklistPendentes: number
    checklistAtrasados: number
    receitas: number
    despesas: number
    saldo: number
  }
  risk: {
    score: number
    level: ExecutionSeverity
  }
  generatedAt: string
}
