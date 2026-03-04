'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api/client'
import type { ConstructionDocsTemplate, ConstructionDocType } from '@/shared/types/construction-docs'

const DOC_TYPES: ConstructionDocType[] = ['INSPECTION', 'SOP', 'SCHEDULE']

function createDefaultDsl(name: string) {
  return {
    version: 1,
    blocks: [
      {
        id: `header-${Date.now()}`,
        type: 'header',
        props: { title: name },
      },
      {
        id: `summary-${Date.now()}`,
        type: 'text',
        props: { text: '{{summary}}' },
      },
      {
        id: `section-${Date.now()}`,
        type: 'section',
        props: { title: 'Detalhes' },
      },
    ],
  }
}

export function ConstructionDocsTemplatesContent() {
  const [templates, setTemplates] = useState<ConstructionDocsTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('Template padrão')
  const [docType, setDocType] = useState<ConstructionDocType>('INSPECTION')

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active),
    [templates]
  )

  async function load() {
    setLoading(true)
    try {
      const data = await apiRequest<ConstructionDocsTemplate[]>('/api/v1/construction-docs/templates')
      setTemplates(data || [])
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao carregar templates', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function createTemplate() {
    const templateName = name.trim()
    if (templateName.length < 3) {
      toast('Informe um nome com pelo menos 3 caracteres', 'error')
      return
    }

    setSaving(true)
    try {
      await apiRequest('/api/v1/construction-docs/templates', {
        method: 'POST',
        body: {
          doc_type: docType,
          name: templateName,
          dsl: createDefaultDsl(templateName),
          is_active: true,
        },
      })
      toast('Template criado', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao criar template', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function activateTemplate(templateId: string) {
    setSaving(true)
    try {
      await apiRequest('/api/v1/construction-docs/templates', {
        method: 'PATCH',
        body: {
          id: templateId,
          patch: {
            is_active: true,
          },
        },
      })
      toast('Template ativado', 'success')
      await load()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erro ao ativar template', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tailadmin-page space-y-4" aria-busy={loading || saving}>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Nome do template</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
              placeholder="Template de vistoria"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Tipo</label>
            <select
              value={docType}
              onChange={(event) => setDocType(event.target.value as ConstructionDocType)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
            >
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void createTemplate()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar template
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {loading && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
            Carregando templates...
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
            Nenhum template cadastrado. Crie o primeiro template para habilitar geração de documentos.
          </div>
        )}

        {templates.map((template) => {
          const isActive = activeTemplates.some((item) => item.id === template.id)
          return (
            <div
              key={template.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{template.name}</h3>
                  <p className="text-xs text-gray-500">{template.doc_type} · v{template.version}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void activateTemplate(template.id)}
                disabled={saving || isActive}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Definir como ativo
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
