'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
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
import type { GeneralTask, GeneralTaskPriority, GeneralTaskStatus } from '@/shared/types/general-tasks'

interface PaginationMeta {
  count: number
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

const PAGE_SIZE = 100

const STATUS_COLUMNS: Array<{ status: GeneralTaskStatus; title: string }> = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'Em andamento' },
  { status: 'blocked', title: 'Bloqueado' },
  { status: 'done', title: 'Concluído' },
]

const PRIORITY_COLORS: Record<GeneralTaskPriority, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
}

const PRIORITY_LABELS: Record<GeneralTaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
}

function formatDate(date: string | null) {
  if (!date) return 'Sem prazo'
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

export function GeneralTasksContent() {
  const [tasks, setTasks] = useState<GeneralTask[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>({
    count: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const moduleEnabled = featureFlags.generalTasksV1

  async function load(page = 1) {
    if (!moduleEnabled) return
    setLoading(true)
    setError(null)
    try {
      const payload = await apiRequestWithMeta<GeneralTask[], PaginationMeta>(
        `/api/v1/general-tasks?page=${page}&pageSize=${PAGE_SIZE}`
      )
      setTasks(payload.data)
      setPagination(
        payload.meta || {
          count: payload.data.length,
          page,
          pageSize: PAGE_SIZE,
          total: payload.data.length,
          hasMore: false,
        }
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar tarefas'
      setError(message)
      toast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleEnabled])

  async function createTask() {
    const title = newTitle.trim()
    if (title.length < 3) {
      toast('Informe ao menos 3 caracteres no título', 'error')
      return
    }
    setSaving(true)
    try {
      await apiRequest('/api/v1/general-tasks', {
        method: 'POST',
        body: {
          title,
          status: 'todo',
          priority: 'medium',
        },
      })
      setNewTitle('')
      toast('Tarefa criada', 'success')
      await load(1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao criar tarefa', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function updateTask(taskId: string, updates: Partial<GeneralTask>) {
    setSaving(true)
    try {
      await apiRequest(`/api/v1/general-tasks/${taskId}`, {
        method: 'PATCH',
        body: updates,
      })
      await load(pagination.page || 1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao atualizar tarefa', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTask(taskId: string) {
    setSaving(true)
    try {
      await apiRequest(`/api/v1/general-tasks/${taskId}`, { method: 'DELETE' })
      toast('Tarefa removida', 'info')
      await load(pagination.page || 1)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao remover tarefa', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function moveTask(taskId: string, nextStatus: GeneralTaskStatus) {
    await updateTask(taskId, { status: nextStatus })
  }

  const tasksByStatus = useMemo(() => {
    const map: Record<GeneralTaskStatus, GeneralTask[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    }
    for (const task of tasks) map[task.status].push(task)
    return map
  }, [tasks])

  if (!moduleEnabled) {
    return (
      <SectionCard className="p-4">
        <p className="text-sm text-gray-500">
          Módulo de tarefas gerais desativado por feature flag.
        </p>
      </SectionCard>
    )
  }

  return (
    <div aria-busy={loading || saving} className="tailadmin-page space-y-4">
      <PageHeader
        title="Tarefas Gerais"
        subtitle={`${pagination.total} tarefa(s) da organização`}
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

      <SectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Nova tarefa geral..."
            className="min-w-[260px] flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={() => void createTask()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sand-600 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar
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

      {tasks.length === 0 && !loading ? (
        <EmptyStateAction
          title="Nenhuma tarefa geral ainda"
          description="Use este quadro para pendências da empresa que não pertencem a uma obra específica."
          actionLabel="Criar primeira tarefa"
          onAction={() => void createTask()}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-4">
          {STATUS_COLUMNS.map((column) => (
            <SectionCard key={column.status} className="min-h-[320px] p-3">
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!dragTaskId) return
                  void moveTask(dragTaskId, column.status)
                  setDragTaskId(null)
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{column.title}</h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {tasksByStatus[column.status].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {tasksByStatus[column.status].map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDragTaskId(task.id)}
                      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
                        <button
                          type="button"
                          onClick={() => void deleteTask(task.id)}
                          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Excluir tarefa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {task.description ? (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-3">{task.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_COLORS[task.priority]}`}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        <span className="text-[11px] text-gray-500">{formatDate(task.due_date)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        hasMore={pagination.hasMore}
        isLoading={loading}
        onPrev={() => void load(Math.max(1, pagination.page - 1))}
        onNext={() => void load(pagination.page + 1)}
      />
    </div>
  )
}
