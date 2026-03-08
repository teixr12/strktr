export interface FinanceDepthMonthlyPoint {
  month: string
  label: string
  receitas: number
  despesas: number
  saldo: number
}

export interface FinanceDepthCategoryPoint {
  categoria: string
  total: number
  count: number
}

export interface FinanceDepthAlert {
  code: string
  title: string
  severity: 'low' | 'medium' | 'high'
  message?: string
}

export interface FinanceDepthPayload {
  summary: {
    receitas: number
    despesas: number
    saldo: number
    averageMonthlyNet: number
    negativeMonths: number
    monthsAnalyzed: number
  }
  monthly: FinanceDepthMonthlyPoint[]
  topExpenseCategories: FinanceDepthCategoryPoint[]
  alerts: FinanceDepthAlert[]
  generatedAt: string
}
