export const KANBAN_COLUMNS = [
  { id: 'Novo' as const, label: 'Novo Lead', dot: '#9ca3af', bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  { id: 'Qualificado' as const, label: 'Qualificado', dot: '#f59e0b', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { id: 'Proposta' as const, label: 'Proposta', dot: '#3b82f6', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'Negociação' as const, label: 'Negociação', dot: '#8b5cf6', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { id: 'Fechado' as const, label: 'Fechado ✓', dot: '#10b981', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { id: 'Perdido' as const, label: 'Perdido', dot: '#ef4444', bg: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
] as const

export const OBRA_STATUS_COLORS: Record<string, string> = {
  'Em Andamento': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Concluída': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Pausada': 'bg-gray-100 text-gray-600',
  'Cancelada': 'bg-red-100 text-red-700',
  'Orçamento': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export const OBRA_ICON_COLORS: Record<string, string> = {
  sand: 'from-sand-200 to-sand-300 dark:from-sand-800 dark:to-sand-900',
  ocean: 'from-ocean-200 to-ocean-300 dark:from-ocean-800 dark:to-ocean-900',
  green: 'from-green-200 to-green-300 dark:from-green-800 dark:to-green-900',
}

export const TEMPERATURA_EMOJI: Record<string, string> = {
  Hot: '🔥',
  Morno: '🌤',
  Frio: '❄️',
}

export const TEMPERATURA_COLORS: Record<string, string> = {
  Hot: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Morno: 'bg-amber-100 text-amber-700',
  Frio: 'bg-blue-100 text-blue-700',
}

export const TIPO_VISITA_COLORS: Record<string, string> = {
  Visita: 'bg-sand-100 text-sand-700',
  Reunião: 'bg-ocean-100 text-ocean-700',
  Vistoria: 'bg-purple-100 text-purple-700',
  Entrega: 'bg-emerald-100 text-emerald-700',
  Outro: 'bg-gray-100 text-gray-600',
}

export const VISITA_STATUS_COLORS: Record<string, string> = {
  Agendado: 'bg-amber-100 text-amber-700',
  Realizado: 'bg-emerald-100 text-emerald-700',
  Cancelado: 'bg-red-100 text-red-500',
  Reagendado: 'bg-blue-100 text-blue-700',
}

export const MEMBRO_STATUS_COLORS: Record<string, string> = {
  Ativo: 'bg-emerald-100 text-emerald-700',
  Inativo: 'bg-gray-100 text-gray-500',
  Férias: 'bg-blue-100 text-blue-700',
}

export const ORC_STATUS_COLORS: Record<string, string> = {
  Rascunho: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  Enviado: 'bg-blue-100 text-blue-700',
  Aprovado: 'bg-emerald-100 text-emerald-700',
  Recusado: 'bg-red-100 text-red-500',
}

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'LayoutGrid', href: '/dashboard' },
  { id: 'obras', label: 'Obras', icon: 'HardHat', href: '/obras', badge: 'obras' },
  { id: 'leads', label: 'Leads VIP', icon: 'Crown', href: '/leads', badge: 'leads' },
  { id: 'orcamentos', label: 'Orçamentos', icon: 'FileText', href: '/orcamentos', badge: 'orc' },
  { id: 'financeiro', label: 'Financeiro', icon: 'Wallet', href: '/financeiro' },
  { id: 'equipe', label: 'Equipe', icon: 'Users', href: '/equipe' },
  { id: 'calendario', label: 'Agenda', icon: 'CalendarDays', href: '/calendario' },
] as const
