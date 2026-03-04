'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, FileDown, Loader2, Mail, Printer, Send } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'

interface ShareLink {
  id: string
  expires_at: string
  revoked_at: string | null
}

interface DocumentPayload {
  id: string
  type: 'INSPECTION' | 'SOP' | 'SCHEDULE'
  status: 'DRAFT' | 'FINAL'
  payload: Record<string, unknown>
  rendered_html: string | null
  updated_at: string
  share_links?: ShareLink[]
}

interface PdfResponse {
  downloadUrl: string | null
  base64: string | null
  fileName: string
}

interface ShareLinkResponse {
  id: string
  share_url: string
  expires_at: string
  password_protected: boolean
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR')
}

export function ConstructionDocsDocumentContent({ documentId }: { documentId: string }) {
  const [doc, setDoc] = useState<DocumentPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [shareLink, setShareLink] = useState<string>('')

  const summaryText = useMemo(() => {
    if (!doc) return ''
    const summary = doc.payload?.summary
    return typeof summary === 'string' ? summary : ''
  }, [doc])

  async function load() {
    setLoading(true)
    try {
      const data = await apiRequest<DocumentPayload>(`/api/v1/construction-docs/documents/${documentId}`)
      setDoc(data)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao carregar documento', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId])

  async function exportPdf() {
    setSaving(true)
    try {
      const payload = await apiRequest<PdfResponse>(
        `/api/v1/construction-docs/documents/${documentId}/export/pdf`,
        { method: 'POST' }
      )

      if (payload.downloadUrl) {
        window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer')
      } else if (payload.base64) {
        const bytes = Uint8Array.from(atob(payload.base64), (char) => char.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank', 'noopener,noreferrer')
      }

      toast('PDF gerado', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao exportar PDF', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function exportCsv() {
    setSaving(true)
    try {
      const payload = await apiRequest<{ fileName: string; csv: string }>(
        `/api/v1/construction-docs/documents/${documentId}/export/csv`
      )
      const blob = new Blob([payload.csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = payload.fileName
      link.click()
      URL.revokeObjectURL(url)
      toast('CSV exportado', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao exportar CSV', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function createShareLink() {
    setSaving(true)
    try {
      const payload = await apiRequest<ShareLinkResponse>(
        `/api/v1/construction-docs/documents/${documentId}/share-links`,
        {
          method: 'POST',
          body: {
            expires_in_days: 7,
            password: sharePassword.trim() || null,
          },
        }
      )
      setShareLink(payload.share_url)
      toast('Link de compartilhamento criado', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao criar link', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendEmail() {
    if (!email.trim()) {
      toast('Informe o e-mail de destino', 'error')
      return
    }
    setSaving(true)
    try {
      await apiRequest(`/api/v1/construction-docs/documents/${documentId}/send-email`, {
        method: 'POST',
        body: {
          to: email.trim(),
          share_url: shareLink || undefined,
        },
      })
      toast('E-mail enviado', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao enviar e-mail', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function shareWhatsApp() {
    if (!phone.trim()) {
      toast('Informe o telefone de destino', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = await apiRequest<{ success: boolean; fallbackUrl?: string }>(
        `/api/v1/construction-docs/documents/${documentId}/share/whatsapp`,
        {
          method: 'POST',
          body: {
            to: phone.trim(),
            share_url: shareLink || undefined,
          },
        }
      )

      if (!payload.success && payload.fallbackUrl) {
        window.open(payload.fallbackUrl, '_blank', 'noopener,noreferrer')
      }

      toast('Compartilhamento processado', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao compartilhar no WhatsApp', 'error')
    } finally {
      setSaving(false)
    }
  }

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard
      .writeText(shareLink)
      .then(() => toast('Link copiado', 'success'))
      .catch(() => toast('Não foi possível copiar o link', 'error'))
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={loading || saving}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Documento Construction Docs</h1>
        <p className="mt-1 text-xs text-gray-500">
          {documentId} · {doc?.type || '...'} · atualizado em {doc ? formatDate(doc.updated_at) : '...'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

        {summaryText && <p className="text-sm text-gray-600 dark:text-gray-300">{summaryText}</p>}

        {!summaryText && (
          <p className="text-sm text-gray-500">Resumo não disponível. Use o preview HTML abaixo.</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Compartilhar</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={sharePassword}
              onChange={(event) => setSharePassword(event.target.value)}
              placeholder="Senha opcional para link"
              className="min-w-[220px] flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <button
              type="button"
              onClick={() => void createShareLink()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              Gerar link
            </button>
          </div>

          {shareLink && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="break-all">{shareLink}</p>
              <button
                type="button"
                onClick={copyShareLink}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </button>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="cliente@empresa.com"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
              <button
                type="button"
                onClick={() => void sendEmail()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Mail className="h-4 w-4" />
                Enviar e-mail
              </button>
            </div>

            <div className="space-y-2">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="55 11 99999-9999"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              />
              <button
                type="button"
                onClick={() => void shareWhatsApp()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <Send className="h-4 w-4" />
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Preview HTML</h2>
        {doc?.rendered_html ? (
          <iframe
            title="Documento renderizado"
            srcDoc={doc.rendered_html}
            className="h-[420px] w-full rounded-xl border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <p className="text-sm text-gray-500">Sem HTML renderizado para este documento.</p>
        )}
      </div>
    </div>
  )
}
