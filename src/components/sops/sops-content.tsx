'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Copy,
  FileDown,
  Loader2,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import {
  EmptyStateAction,
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
} from '@/components/ui/enterprise'
import type { SopBlock, SopPdfPayload, SopRecord } from '@/shared/types/sops'

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 20

function blockLabel(type: SopBlock['type']) {
  if (type === 'title') return 'Título'
  if (type === 'image') return 'Imagem'
  return 'Texto'
}

function randomBlockId() {
  return `blk-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, content] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream'
  const binary = atob(content || '')
  const len = binary.length
  const buffer = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) buffer[i] = binary.charCodeAt(i)
  return new Blob([buffer], { type: mime })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function isSafeImageSrc(value: string): boolean {
  return (
    value.startsWith('https://') ||
    value.startsWith('http://') ||
    value.startsWith('data:image/')
  )
}

function buildPrintDocument(title: string, htmlBlocks: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0 0 10px; line-height: 1.6; }
      .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    ${htmlBlocks}
  </body>
</html>`
}

export function SopsContent() {
  const moduleEnabled = featureFlags.sopBuilderV1
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [sops, setSops] = useState<SopRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [whatsAppPhone, setWhatsAppPhone] = useState('')
  const [emailTarget, setEmailTarget] = useState('')
  const [activeImageBlockId, setActiveImageBlockId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
  })

  async function load(page = 1, q = query) {
    if (!moduleEnabled) return
    setLoading(true)
    setError(null)
    try {
      const suffix = q.trim().length > 0 ? `&q=${encodeURIComponent(q.trim())}` : ''
      const payload = await apiRequestWithMeta<SopRecord[], PaginationMeta>(
        `/api/v1/sops?page=${page}&pageSize=${PAGE_SIZE}${suffix}`
      )
      setSops(payload.data || [])
      setPagination(
        payload.meta || {
          count: payload.data.length,
          page,
          pageSize: PAGE_SIZE,
          total: payload.data.length,
          hasMore: false,
        }
      )

      if (payload.data.length === 0) {
        setSelectedId(null)
      } else if (!selectedId || !payload.data.some((item) => item.id === selectedId)) {
        setSelectedId(payload.data[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar SOPs'
      setError(message)
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleEnabled])

  const selected = useMemo(
    () => sops.find((item) => item.id === selectedId) || null,
    [sops, selectedId]
  )

  async function createSop() {
    const title = draftTitle.trim()
    if (title.length < 3) {
      toast('Informe ao menos 3 caracteres no título', 'error')
      return
    }
    setSaving(true)
    try {
      const created = await apiRequest<SopRecord>('/api/v1/sops', {
        method: 'POST',
        body: {
          title,
          status: 'draft',
          blocks: [
            {
              id: randomBlockId(),
              type: 'title',
              content: title,
            },
          ],
        },
      })
      setDraftTitle('')
      toast('SOP criada', 'success')
      setSops((prev) => [created, ...prev])
      setSelectedId(created.id)
      await load(1, query)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar SOP', 'error')
    } finally {
      setSaving(false)
    }
  }

  function updateSelectedLocally(next: SopRecord) {
    setSops((prev) => prev.map((item) => (item.id === next.id ? next : item)))
    setSelectedId(next.id)
  }

  async function persistSelected(partial: Partial<SopRecord>) {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await apiRequest<SopRecord>(`/api/v1/sops/${selected.id}`, {
        method: 'PATCH',
        body: partial,
      })
      updateSelectedLocally(updated)
      toast('SOP atualizada', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar SOP', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelected() {
    if (!selected) return
    if (!window.confirm(`Excluir SOP "${selected.title}"?`)) return
    setSaving(true)
    try {
      await apiRequest(`/api/v1/sops/${selected.id}`, { method: 'DELETE' })
      toast('SOP removida', 'info')
      const nextItems = sops.filter((item) => item.id !== selected.id)
      setSops(nextItems)
      setSelectedId(nextItems[0]?.id || null)
      if (nextItems.length === 0) {
        await load(1, query)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao remover SOP', 'error')
    } finally {
      setSaving(false)
    }
  }

  function updateBlocks(nextBlocks: SopBlock[]) {
    if (!selected) return
    updateSelectedLocally({
      ...selected,
      blocks: nextBlocks,
      updated_at: new Date().toISOString(),
    })
  }

  function addBlock(type: SopBlock['type']) {
    if (!selected) return
    const next = [...selected.blocks]
    next.push({
      id: randomBlockId(),
      type,
      content: type === 'image' ? '' : type === 'title' ? 'Novo título' : 'Novo texto',
    })
    updateBlocks(next)
  }

  function removeBlock(blockId: string) {
    if (!selected) return
    updateBlocks(selected.blocks.filter((block) => block.id !== blockId))
  }

  function moveBlock(fromIndex: number, toIndex: number) {
    if (!selected) return
    if (toIndex < 0 || toIndex >= selected.blocks.length) return
    const next = [...selected.blocks]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    updateBlocks(next)
  }

  function openPrintPreview() {
    if (!selected) return
    const htmlBlocks = selected.blocks
      .map((block) => {
        if (block.type === 'title') return `<h2>${escapeHtml(block.content)}</h2>`
        if (block.type === 'image') {
          const safeSrc = isSafeImageSrc(block.content) ? escapeHtml(block.content) : ''
          if (!safeSrc) {
            return '<p>[Imagem inválida removida da impressão]</p>'
          }
          return `<img src="${safeSrc}" alt="SOP image" style="max-width:100%;border-radius:8px;" />`
        }
        return `<p>${escapeHtml(block.content)}</p>`
      })
      .join('\n')

    const htmlDocument = buildPrintDocument(selected.title, htmlBlocks)
    const htmlBlob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' })
    const printUrl = URL.createObjectURL(htmlBlob)
    const printWindow = window.open(printUrl, '_blank', 'noopener,noreferrer,width=900,height=700')
    if (!printWindow) {
      URL.revokeObjectURL(printUrl)
      toast('Não foi possível abrir a pré-visualização de impressão', 'error')
      return
    }
    const cleanup = () => URL.revokeObjectURL(printUrl)
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
    printWindow.onafterprint = cleanup
    printWindow.onbeforeunload = cleanup
    window.setTimeout(cleanup, 60_000)
  }

  async function exportPdf() {
    if (!selected) return
    setSaving(true)
    try {
      const payload = await apiRequest<SopPdfPayload>(`/api/v1/sops/${selected.id}/export/pdf`, {
        method: 'POST',
      })
      if (payload.downloadUrl) {
        window.open(payload.downloadUrl, '_blank', 'noopener,noreferrer')
      } else if (payload.base64) {
        const blob = dataUrlToBlob(`data:application/pdf;base64,${payload.base64}`)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = payload.fileName
        anchor.click()
        URL.revokeObjectURL(url)
      }
      toast('PDF gerado com sucesso', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao exportar PDF', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function shareWhatsApp() {
    if (!selected) return
    if (whatsAppPhone.trim().length < 8) {
      toast('Informe um telefone válido', 'error')
      return
    }
    setSaving(true)
    try {
      const result = await apiRequest<{ success: boolean; fallbackUrl?: string; message?: string }>(
        `/api/v1/sops/${selected.id}/share/whatsapp`,
        {
          method: 'POST',
          body: { to: whatsAppPhone },
        }
      )
      if (!result.success && result.fallbackUrl) {
        window.open(result.fallbackUrl, '_blank', 'noopener,noreferrer')
        toast('WhatsApp API indisponível. Abrimos fallback link.', 'info')
      } else {
        toast('SOP enviada no WhatsApp', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao compartilhar no WhatsApp', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function sendByEmail() {
    if (!selected) return
    if (!emailTarget.includes('@')) {
      toast('Informe um e-mail válido', 'error')
      return
    }
    setSaving(true)
    try {
      await apiRequest(`/api/v1/sops/${selected.id}/send-email`, {
        method: 'POST',
        body: { to: emailTarget },
      })
      toast('SOP enviada por e-mail', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao enviar e-mail', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !selected || !activeImageBlockId) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      const nextBlocks = selected.blocks.map((block) =>
        block.id === activeImageBlockId ? { ...block, content: result } : block
      )
      updateBlocks(nextBlocks)
      toast('Imagem carregada no bloco', 'success')
      setActiveImageBlockId(null)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
    reader.readAsDataURL(file)
  }

  if (!moduleEnabled) {
    return (
      <SectionCard className="p-4">
        <p className="text-sm text-gray-500">
          Módulo SOP Builder desativado por feature flag.
        </p>
      </SectionCard>
    )
  }

  return (
    <div aria-busy={loading || saving} className="tailadmin-page space-y-4">
      <PageHeader
        title="SOP Builder"
        subtitle={`${pagination.total} SOP(s) cadastradas`}
        actions={
          <QuickActionBar
            actions={[
              {
                label: 'Recarregar',
                icon: <RefreshCw className="h-4 w-4" />,
                onClick: () => void load(pagination.page || 1),
                tone: 'neutral',
              },
            ]}
          />
        }
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleImageUpload(event)}
      />

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Nova SOP..."
            className="min-w-[220px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={() => void createSop()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar SOP..."
            className="min-w-[180px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={() => void load(1, query)}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Buscar
          </button>
        </div>
      </SectionCard>

      {error ? (
        <SectionCard className="border border-red-200/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load(pagination.page || 1)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Tentar novamente
            </button>
          </div>
        </SectionCard>
      ) : null}

      {sops.length === 0 && !loading ? (
        <EmptyStateAction
          title="Nenhuma SOP cadastrada"
          description="Crie uma SOP com blocos visuais, branding, exportação PDF e compartilhamento."
          actionLabel="Criar primeira SOP"
          onAction={() => void createSop()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SectionCard className="space-y-2 p-3">
            {sops.map((sop) => (
              <button
                key={sop.id}
                type="button"
                onClick={() => setSelectedId(sop.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                  selectedId === sop.id
                    ? 'border-sand-300 bg-sand-50 dark:border-sand-700/60 dark:bg-sand-900/20'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
                }`}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{sop.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {sop.status} · {new Date(sop.updated_at).toLocaleDateString('pt-BR')}
                </p>
              </button>
            ))}
          </SectionCard>

          {selected ? (
            <SectionCard className="space-y-4 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={selected.title}
                  onChange={(event) =>
                    updateSelectedLocally({ ...selected, title: event.target.value })
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <select
                  value={selected.status}
                  onChange={(event) =>
                    updateSelectedLocally({
                      ...selected,
                      status: event.target.value as SopRecord['status'],
                    })
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </div>

              <textarea
                value={selected.description || ''}
                onChange={(event) =>
                  updateSelectedLocally({
                    ...selected,
                    description: event.target.value,
                  })
                }
                rows={3}
                placeholder="Descrição da SOP..."
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => addBlock('title')}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  + Bloco título
                </button>
                <button
                  type="button"
                  onClick={() => addBlock('text')}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  + Bloco texto
                </button>
                <button
                  type="button"
                  onClick={() => addBlock('image')}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  + Bloco imagem
                </button>
              </div>

              <div className="space-y-2">
                {selected.blocks.map((block, index) => (
                  <div
                    key={block.id}
                    className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {index + 1}. {blockLabel(block.type)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(index, index - 1)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(index, index + 1)}
                          className="rounded-md bg-gray-100 px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    {block.type === 'image' ? (
                      <div className="space-y-2">
                        <input
                          value={block.content}
                          onChange={(event) => {
                            const next = selected.blocks.map((entry) =>
                              entry.id === block.id ? { ...entry, content: event.target.value } : entry
                            )
                            updateBlocks(next)
                          }}
                          placeholder="Cole uma URL ou use upload..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-950"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveImageBlockId(block.id)
                              imageInputRef.current?.click()
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload imagem
                          </button>
                        </div>
                        {block.content ? (
                          <Image
                            src={block.content}
                            alt="SOP block"
                            width={960}
                            height={540}
                            unoptimized
                            className="max-h-48 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <textarea
                        value={block.content}
                        onChange={(event) => {
                          const next = selected.blocks.map((entry) =>
                            entry.id === block.id ? { ...entry, content: event.target.value } : entry
                          )
                          updateBlocks(next)
                        }}
                        rows={block.type === 'title' ? 2 : 4}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={selected.branding.company_name || ''}
                  onChange={(event) =>
                    updateSelectedLocally({
                      ...selected,
                      branding: { ...selected.branding, company_name: event.target.value },
                    })
                  }
                  placeholder="Nome da empresa"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <input
                  value={selected.branding.company_document || ''}
                  onChange={(event) =>
                    updateSelectedLocally({
                      ...selected,
                      branding: { ...selected.branding, company_document: event.target.value },
                    })
                  }
                  placeholder="CNPJ/Documento"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <input
                  value={selected.branding.responsible_name || ''}
                  onChange={(event) =>
                    updateSelectedLocally({
                      ...selected,
                      branding: { ...selected.branding, responsible_name: event.target.value },
                    })
                  }
                  placeholder="Responsável"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
                <input
                  value={selected.branding.logo_url || ''}
                  onChange={(event) =>
                    updateSelectedLocally({
                      ...selected,
                      branding: { ...selected.branding, logo_url: event.target.value },
                    })
                  }
                  placeholder="Logo URL"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void persistSelected({
                      title: selected.title,
                      description: selected.description,
                      status: selected.status,
                      blocks: selected.blocks,
                      branding: selected.branding,
                    })
                  }
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => void exportPdf()}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  <FileDown className="h-4 w-4" />
                  Exportar PDF
                </button>
                <button
                  type="button"
                  onClick={() => openPrintPreview()}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Compartilhar por WhatsApp
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      value={whatsAppPhone}
                      onChange={(event) => setWhatsAppPhone(event.target.value)}
                      placeholder="Telefone com DDI"
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => void shareWhatsApp()}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Enviar
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                  <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Enviar por e-mail
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      value={emailTarget}
                      onChange={(event) => setEmailTarget(event.target.value)}
                      placeholder="email@empresa.com"
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                    />
                    <button
                      type="button"
                      onClick={() => void sendByEmail()}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      )}

      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        hasMore={pagination.hasMore}
        isLoading={loading}
        onPrev={() => void load(Math.max(1, pagination.page - 1), query)}
        onNext={() => void load(pagination.page + 1, query)}
      />
    </div>
  )
}
