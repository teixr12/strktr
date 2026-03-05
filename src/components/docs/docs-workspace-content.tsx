'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  ClipboardList,
  FileText,
  FolderOpen,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { track } from '@/lib/analytics/client'
import { apiRequestWithMeta } from '@/lib/api/client'
import { featureFlags } from '@/lib/feature-flags'
import {
  EmptyStateAction,
  PageHeader,
  PaginationControls,
  QuickActionBar,
  SectionCard,
} from '@/components/ui/enterprise'
import type {
  DocsWorkspaceItem,
  DocsWorkspaceItemKind,
  DocsWorkspacePayload,
} from '@/shared/types/docs-workspace'

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface ResponseMeta {
  pagination?: PaginationMeta
}

const PAGE_SIZE = 24

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR')
}

function kindLabel(kind: DocsWorkspaceItemKind): string {
  if (kind === 'legacy_sop') return 'SOP'
  if (kind === 'construction_document') return 'Documento'
  if (kind === 'visit') return 'Visita'
  return 'Template'
}

function kindIcon(kind: DocsWorkspaceItemKind) {
  if (kind === 'legacy_sop') return <ClipboardList className="h-4 w-4" />
  if (kind === 'construction_document') return <FileText className="h-4 w-4" />
  if (kind === 'visit') return <FolderOpen className="h-4 w-4" />
  return <Layers3 className="h-4 w-4" />
}

function kindTone(kind: DocsWorkspaceItemKind): string {
  if (kind === 'legacy_sop') return 'bg-sand-100 text-sand-700 dark:bg-sand-900/30 dark:text-sand-300'
  if (kind === 'construction_document') return 'bg-ocean-100 text-ocean-700 dark:bg-ocean-900/30 dark:text-ocean-300'
  if (kind === 'visit') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
}

export function DocsWorkspaceContent() {
  const enabled = featureFlags.docsWorkspaceV1
  const trackedRef = useRef(false)
  const [items, setItems] = useState<DocsWorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<'all' | DocsWorkspaceItemKind>('all')
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
  })

  async function load(page = 1, nextQuery = query, nextKind = kind) {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      })
      if (nextQuery.trim().length > 0) params.set('q', nextQuery.trim())
      if (nextKind !== 'all') params.set('kind', nextKind)

      const response = await apiRequestWithMeta<DocsWorkspacePayload, ResponseMeta>(
        `/api/v1/docs?${params.toString()}`
      )

      setItems(response.data.items || [])
      setPagination(
        response.meta?.pagination || {
          count: response.data.items.length,
          page,
          pageSize: PAGE_SIZE,
          total: response.data.items.length,
          hasMore: false,
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar docs'
      setItems([])
      setError(message)
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1, query, kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query, kind])

  useEffect(() => {
    if (!enabled || trackedRef.current) return
    trackedRef.current = true
    void track('docs_workspace_opened', {
      source: 'web',
      route: '/docs',
      outcome: 'success',
      entity_type: 'workspace',
      entity_id: 'docs',
    }).catch(() => undefined)
  }, [enabled])

  const summary = useMemo(() => {
    return {
      sops: items.filter((item) => item.kind === 'legacy_sop').length,
      docs: items.filter((item) => item.kind === 'construction_document').length,
      visits: items.filter((item) => item.kind === 'visit').length,
      templates: items.filter((item) => item.kind === 'template').length,
    }
  }, [items])

  if (!enabled) {
    return (
      <EmptyStateAction
        icon={<BookOpen className="h-5 w-5 text-sand-600" />}
        title="Workspace de Docs indisponível"
        description="Ative a flag NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1 para acessar a experiência unificada."
        actionLabel="Abrir SOP Builder"
        actionHref="/sops"
      />
    )
  }

  return (
    <div className="space-y-4" aria-busy={loading}>
      <PageHeader
        title="Docs"
        subtitle="Workspace unificado para SOPs, documentos de obra, visitas e templates."
        statusLabel="Compatibilidade ativa"
        actions={
          <QuickActionBar
            actions={[
              { label: 'Construction Docs', href: '/construction-docs/projects', tone: 'warning' },
              { label: 'SOP Builder', href: '/sops', tone: 'neutral' },
            ]}
          />
        }
      />

      <SectionCard
        title="Visão geral"
        subtitle="Use este workspace para navegar pelos dois domínios sem quebrar os fluxos antigos."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-700/70">
            <p className="text-xs uppercase tracking-wide text-gray-500">SOPs</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.sops}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-700/70">
            <p className="text-xs uppercase tracking-wide text-gray-500">Documentos</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.docs}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-700/70">
            <p className="text-xs uppercase tracking-wide text-gray-500">Visitas</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.visits}</p>
          </div>
          <div className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-700/70">
            <p className="text-xs uppercase tracking-wide text-gray-500">Templates</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.templates}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Buscar e filtrar"
        subtitle="A busca cobre SOPs legadas, documentos, visitas e templates."
        right={
          <button
            type="button"
            onClick={() => void load(pagination.page, query, kind)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recarregar
          </button>
        }
      >
        <form
          className="flex flex-col gap-3 md:flex-row md:items-center"
          onSubmit={(event) => {
            event.preventDefault()
            setPagination((current) => ({ ...current, page: 1 }))
            setQuery(queryInput.trim())
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">Buscar docs</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Buscar por nome, projeto, obra ou status"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-500">
            <span>Tipo</span>
            <select
              value={kind}
              onChange={(event) => {
                const nextKind = event.target.value as 'all' | DocsWorkspaceItemKind
                setPagination((current) => ({ ...current, page: 1 }))
                setKind(nextKind)
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="all">Todos</option>
              <option value="legacy_sop">SOP</option>
              <option value="construction_document">Documento</option>
              <option value="visit">Visita</option>
              <option value="template">Template</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600"
          >
            Buscar
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Itens"
        subtitle="Os deep links antigos continuam disponíveis durante a convergência."
      >
        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Erro ao carregar docs</p>
            <p className="mt-1 text-sm text-rose-600/90 dark:text-rose-300/80">{error}</p>
            <button
              type="button"
              onClick={() => void load(pagination.page, query, kind)}
              className="mt-3 inline-flex rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              Tentar novamente
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyStateAction
            icon={<BookOpen className="h-5 w-5 text-sand-600" />}
            title="Nenhum item encontrado"
            description="Ajuste os filtros ou abra os fluxos legados para criar o primeiro documento."
            actionLabel="Abrir Construction Docs"
            actionHref="/construction-docs/projects"
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={`${item.kind}-${item.id}`}
                className="rounded-2xl border border-gray-200/70 p-4 dark:border-gray-700/70"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${kindTone(item.kind)}`}>
                        {kindIcon(item.kind)}
                        {kindLabel(item.kind)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {item.source_module === 'sops' ? 'SOP Builder' : 'Construction Docs'}
                      </span>
                      {item.status ? (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {item.status}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                      {item.title}
                    </h3>
                    {item.subtitle ? (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.subtitle}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {item.project_name ? (
                        <span className="rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-900/60">
                          Projeto: {item.project_name}
                        </span>
                      ) : null}
                      {item.obra_name ? (
                        <span className="rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-900/60">
                          Obra: {item.obra_name}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-gray-50 px-2 py-1 dark:bg-gray-900/60">
                        Atualizado em {formatDate(item.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={item.href}
                      className="inline-flex rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Abrir
                    </Link>
                  </div>
                </div>
              </article>
            ))}

            <PaginationControls
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              hasMore={pagination.hasMore}
              isLoading={loading}
              onPrev={() => {
                if (pagination.page <= 1) return
                const nextPage = pagination.page - 1
                setPagination((current) => ({ ...current, page: nextPage }))
                void load(nextPage, query, kind)
              }}
              onNext={() => {
                if (!pagination.hasMore) return
                const nextPage = pagination.page + 1
                setPagination((current) => ({ ...current, page: nextPage }))
                void load(nextPage, query, kind)
              }}
            />
          </div>
        )}
      </SectionCard>
    </div>
  )
}
