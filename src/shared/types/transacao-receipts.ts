export type TransacaoReceiptIntakeStatus =
  | 'uploaded'
  | 'ready_for_review'
  | 'linked'
  | 'failed'

export interface ReceiptSuggestionField<T> {
  value: T | null
  confidence: number | null
}

export interface ReceiptReviewPayload {
  provider: 'gemini' | 'manual'
  status: 'ready_for_review' | 'manual_only' | 'failed'
  raw_text: string | null
  fornecedor: ReceiptSuggestionField<string>
  descricao: ReceiptSuggestionField<string>
  valor_total: ReceiptSuggestionField<number>
  data_emissao: ReceiptSuggestionField<string>
  documento_fiscal: ReceiptSuggestionField<string>
  categoria: ReceiptSuggestionField<string>
  forma_pagamento: ReceiptSuggestionField<string>
  error_reason?: string | null
  error_message?: string | null
}

export interface TransacaoReceiptIntakeSummary {
  id: string
  transacao_id: string | null
  status: TransacaoReceiptIntakeStatus
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  updated_at: string
  signed_url: string | null
  review_payload: ReceiptReviewPayload | null
}

export interface TransacaoAttachmentSummary {
  id: string
  transacao_id: string
  receipt_intake_id: string | null
  original_filename: string
  mime_type: string
  size_bytes: number
  created_at: string
  signed_url: string | null
}
