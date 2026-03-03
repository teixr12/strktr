'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api/client'
import { useToast } from '@/hooks/use-toast'
import { EmptyStateAction } from '@/components/ui/enterprise'
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

interface NotificacaoItem {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  link: string | null
  lida: boolean
  created_at: string
}

const TIPO_CONFIG: Record<string, { icon: typeof Info; color: string; label: string }> = {
  info: { icon: Info, color: 'text-blue-500', label: 'Info' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', label: 'Aviso' },
  success: { icon: CheckCircle, color: 'text-emerald-500', label: 'Sucesso' },
  urgent: { icon: AlertCircle, color: 'text-red-500', label: 'Urgente' },
}

type FilterTab = 'all' | 'unread' | 'urgent'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d atrás`
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function groupByDate(items: NotificacaoItem[]) {
  const groups: Array<{ label: string; items: NotificacaoItem[] }> = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const buckets = {
    today: [] as NotificacaoItem[],
    yesterday: [] as NotificacaoItem[],
    thisWeek: [] as NotificacaoItem[],
    older: [] as NotificacaoItem[],
  }

  for (const item of items) {
    const d = new Date(item.created_at)
    if (d >= today) buckets.today.push(item)
    else if (d >= yesterday) buckets.yesterday.push(item)
    else if (d >= weekAgo) buckets.thisWeek.push(item)
    else buckets.older.push(item)
  }

  if (buckets.today.length > 0) groups.push({ label: 'Hoje', items: buckets.today })
  if (buckets.yesterday.length > 0) groups.push({ label: 'Ontem', items: buckets.yesterday })
  if (buckets.thisWeek.length > 0) groups.push({ label: 'Esta semana', items: buckets.thisWeek })
  if (buckets.older.length > 0) groups.push({ label: 'Anteriores', items: buckets.older })

  return groups
}

interface NotificacoesContentProps {
  initialNotificacoes: NotificacaoItem[]
}

export function NotificacoesContent({ initialNotificacoes }: NotificacoesContentProps) {
  const [notificacoes, setNotificacoes] = useState(initialNotificacoes)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<{ type: 'mark-one'; id: string } | { type: 'mark-all' } | null>(null)
  const toast = useToast()

  const unreadCount = notificacoes.filter((n) => !n.lida).length

  const filtered = notificacoes.filter((n) => {
    if (filter === 'unread') return !n.lida
    if (filter === 'urgent') return n.tipo === 'urgent'
    return true
  })

  const groups = groupByDate(filtered)

  async function markAsRead(id: string) {
    const previous = notificacoes
    setSyncError(null)
    setRetryAction(null)
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    setIsSyncing(true)
    try {
      await apiRequest(`/api/v1/notificacoes/${id}`, {
        method: 'PATCH',
        body: { lida: true },
      })
    } catch {
      setNotificacoes(previous)
      setSyncError('Falha ao marcar notificação como lida.')
      setRetryAction({ type: 'mark-one', id })
      toast('Falha ao sincronizar notificação', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  async function markAllRead() {
    const previous = notificacoes
    setSyncError(null)
    setRetryAction(null)
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    setIsSyncing(true)
    try {
      await apiRequest('/api/v1/notificacoes/read-all', { method: 'POST' })
      toast('Todas marcadas como lidas', 'success')
    } catch {
      setNotificacoes(previous)
      setSyncError('Falha ao marcar todas como lidas.')
      setRetryAction({ type: 'mark-all' })
      toast('Falha ao sincronizar notificações', 'error')
    } finally {
      setIsSyncing(false)
    }
  }

  async function retrySync() {
    if (!retryAction) return
    if (retryAction.type === 'mark-all') {
      await markAllRead()
      return
    }
    await markAsRead(retryAction.id)
  }

  function handleClick(n: NotificacaoItem) {
    if (!n.lida) markAsRead(n.id)
    if (n.link) window.location.assign(n.link)
  }

  const TABS: Array<{ value: FilterTab; label: string; count?: number }> = [
    { value: 'all', label: 'Todas', count: notificacoes.length },
    { value: 'unread', label: 'Não lidas', count: unreadCount },
    { value: 'urgent', label: 'Urgentes' },
  ]

  return (
    <div className="tailadmin-page space-y-5" aria-busy={isSyncing}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            Notificações
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={isSyncing}
            className="flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      {syncError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          <div className="flex items-center justify-between gap-2">
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => void retrySync()}
              disabled={isSyncing}
              className="rounded-lg bg-white/70 px-2 py-1 font-semibold text-red-700 hover:bg-white disabled:opacity-60 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
            >
              {isSyncing ? 'Sincronizando...' : 'Tentar novamente'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === tab.value
                ? 'bg-sand-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                filter === tab.value
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyStateAction
          icon={<Bell className="h-5 w-5 text-sand-600" />}
          title={filter === 'unread' ? 'Nenhuma notificação não lida' : filter === 'urgent' ? 'Nenhuma notificação urgente' : 'Nenhuma notificação'}
          description={filter === 'all' ? 'Quando houver atualizações importantes, elas aparecerão aqui.' : 'Altere o filtro para ver outras notificações.'}
          actionLabel="Voltar ao Dashboard"
          actionHref="/dashboard"
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </h3>
              <div className="enterprise-card overflow-hidden">
                {group.items.map((n, i) => {
                  const config = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info
                  const Icon = config.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                        i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''
                      } ${!n.lida ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                    >
                      <div className={`mt-0.5 ${config.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!n.lida ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-600 dark:text-gray-400'}`}>
                            {n.titulo}
                          </p>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {timeAgo(n.created_at)}
                          </span>
                        </div>
                        {n.descricao && (
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {n.descricao}
                          </p>
                        )}
                      </div>
                      {!n.lida && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id) }}
                          className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                          title="Marcar como lida"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
