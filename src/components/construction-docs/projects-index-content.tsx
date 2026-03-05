'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Loader2, RefreshCw, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequestWithMeta } from '@/lib/api/client'
import type {
  ConstructionDocsProjectIndexItem,
  ConstructionDocsProjectIndexPayload,
} from '@/shared/types/construction-docs-projects'

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface ResponseMeta {
  pagination?: PaginationMeta
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('pt-BR')
}

export function ConstructionDocsProjectsIndexContent() {
  const [items, setItems] = useState<ConstructionDocsProjectIndexItem[]>([])
  const [loading, setLoading] = useState(false)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [meta, setMeta] = useState<PaginationMeta | null>(null)

  async function load(activeQuery: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '24' })
      if (activeQuery.trim().length >= 2) {
        params.set('q', activeQuery.trim())
      }
      const result = await apiRequestWithMeta<ConstructionDocsProjectIndexPayload, ResponseMeta>(
        `/api/v1/construction-docs/projects?${params.toString()}`
      )
      setItems(result.data.items || [])
      setMeta(result.meta?.pagination || null)
    } catch (error) {
      setItems([])
      setMeta(null)
      toast(error instanceof Error ? error.message : 'Erro ao carregar projetos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(query)
  }, [query])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    setQuery(queryInput.trim())
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={loading}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Construction Docs · Projetos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecione um projeto para criar visitas, gerar documentos e compartilhar resultados.
        </p>
      </div>

      <form
        onSubmit={submitSearch}
        className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cd-project-search" className="sr-only">
            Buscar projetos
          </label>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="cd-project-search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Buscar por nome do projeto"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={() => void load(query)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recarregar
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Projetos disponíveis</h2>
          <span className="text-xs text-gray-500">
            {meta ? `${meta.total} no total` : `${items.length} carregados`}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Carregando projetos...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
            Nenhum projeto encontrado para este filtro. Crie um projeto em{' '}
            <Link href="/projetos" className="font-semibold text-sand-600 hover:text-sand-700">
              Projetos
            </Link>{' '}
            para iniciar o fluxo de Construction Docs.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.project_id}
                className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.nome}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.cliente || 'Cliente não informado'} · {item.local || 'Local não informado'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        Status: {item.status || '—'}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Visitas: {item.visits_count}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Docs: {item.documents_count}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Última visita: {formatDate(item.latest_visit_date)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/construction-docs/projects/${item.project_id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Abrir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
