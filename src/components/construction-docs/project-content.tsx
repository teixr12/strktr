'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest, apiRequestWithMeta } from '@/lib/api/client'

interface VisitRow {
  id: string
  type: 'PRE' | 'POST'
  visit_date: string
  metadata: Record<string, unknown>
  created_at: string
}

interface VisitsResponse {
  projectLink: {
    id: string
    project_id: string
    obra_id: string | null
  }
  visits: VisitRow[]
}

interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

export function ConstructionDocsProjectContent({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<VisitsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [visitType, setVisitType] = useState<'PRE' | 'POST'>('PRE')
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [prompt, setPrompt] = useState('')

  async function load() {
    setLoading(true)
    try {
      const result = await apiRequestWithMeta<VisitsResponse, { pagination?: PaginationMeta }>(
        `/api/v1/construction-docs/projects/${projectId}/visits`
      )
      setPayload(result.data)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao carregar visitas', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function createVisit() {
    setSaving(true)
    try {
      await apiRequest(`/api/v1/construction-docs/projects/${projectId}/visits`, {
        method: 'POST',
        body: {
          type: visitType,
          visit_date: visitDate,
        },
      })
      toast('Visita criada', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao criar visita', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function generate(type: 'inspection' | 'schedule' | 'sop') {
    setSaving(true)
    try {
      const doc = await apiRequest<{ id: string }>(
        `/api/v1/construction-docs/documents/generate/${type}`,
        {
          method: 'POST',
          body: {
            project_id: projectId,
            prompt: prompt.trim() || undefined,
            input: {
              project_id: projectId,
            },
          },
        }
      )
      toast('Documento gerado', 'success')
      window.location.href = `/construction-docs/documents/${doc.id}`
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao gerar documento', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={loading || saving}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Construction Docs · Projeto</h1>
        <p className="mt-1 text-sm text-gray-500">
          Projeto <span className="font-mono">{projectId}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Nova visita</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs uppercase text-gray-500">Tipo</label>
            <select
              value={visitType}
              onChange={(event) => setVisitType(event.target.value as 'PRE' | 'POST')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              <option value="PRE">Pré-obra</option>
              <option value="POST">Pós-obra</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-gray-500">Data</label>
            <input
              type="date"
              value={visitDate}
              onChange={(event) => setVisitDate(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
          </div>
          <button
            type="button"
            onClick={() => void createVisit()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar visita
          </button>
          <Link
            href={`/construction-docs/projects/${projectId}/visits/new`}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Abrir fluxo guiado
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Gerar documento</h2>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Contexto adicional para IA (opcional)"
          rows={3}
          className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void generate('inspection')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Inspeção
          </button>
          <button
            type="button"
            onClick={() => void generate('schedule')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            Cronograma
          </button>
          <button
            type="button"
            onClick={() => void generate('sop')}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            SOP
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Visitas</h2>

        {loading && <p className="text-sm text-gray-500">Carregando...</p>}

        {!loading && (payload?.visits || []).length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma visita cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {(payload?.visits || []).map((visit) => (
            <Link
              key={visit.id}
              href={`/construction-docs/visits/${visit.id}`}
              className="block rounded-xl border border-gray-200 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {visit.type === 'PRE' ? 'Pré-obra' : 'Pós-obra'} · {new Date(`${visit.visit_date}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-gray-500">{visit.id}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  Abrir
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
