'use client'

import { useState, useEffect, useRef } from 'react'
import { apiRequest } from '@/lib/api/client'
import { Bell, Check, CheckCheck, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import type { Notificacao, NotificacaoTipo } from '@/types/database'

const TIPO_CONFIG: Record<NotificacaoTipo, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  success: { icon: CheckCircle, color: 'text-emerald-500' },
  urgent: { icon: AlertCircle, color: 'text-red-500' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unread = notificacoes.filter((n) => !n.lida).length

  useEffect(() => {
    async function load() {
      try {
        const data = await apiRequest<Notificacao[]>('/api/v1/notificacoes?limit=20')
        setNotificacoes(data)
      } catch {
        setNotificacoes([])
      }
      setLoading(false)
    }
    load()
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAsRead(id: string) {
    await apiRequest<Notificacao>(`/api/v1/notificacoes/${id}`, {
      method: 'PATCH',
      body: { lida: true },
    }).catch(() => undefined)
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    )
  }

  async function markAllRead() {
    await apiRequest<{ success: boolean }>('/api/v1/notificacoes/read-all', {
      method: 'POST',
    }).catch(() => undefined)
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
        title="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notificações</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-sand-600 hover:text-sand-700 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
            ) : notificacoes.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Nenhuma notificação</p>
              </div>
            ) : (
              notificacoes.map((n) => {
                const config = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info
                const Icon = config.icon
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
                      !n.lida ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                    onClick={() => {
                      if (!n.lida) markAsRead(n.id)
                      if (n.link) window.location.href = n.link
                    }}
                  >
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${!n.lida ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                        {n.titulo}
                      </p>
                      {n.descricao && (
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.descricao}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.lida && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id) }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400"
                        title="Marcar como lida"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
