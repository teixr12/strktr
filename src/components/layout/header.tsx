'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Menu, Sun, Moon, Plus, Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/obras': 'Obras',
  '/projetos': 'Projetos',
  '/leads': 'Leads VIP',
  '/orcamentos': 'Orçamentos',
  '/financeiro': 'Financeiro',
  '/compras': 'Compras',
  '/equipe': 'Equipe',
  '/calendario': 'Agenda',
  '/perfil': 'Meu Perfil',
  '/configuracoes': 'Configurações',
}

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const title =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] || 'STRKTR'

  return (
    <header className="h-14 md:h-16 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full border border-emerald-200 dark:border-emerald-800">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Online
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
          title="Notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
        >
          <Sun className="w-5 h-5 hidden dark:block" />
          <Moon className="w-5 h-5 block dark:hidden" />
        </button>
        <Link
          href="/obras"
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-sand-500 hover:bg-sand-600 text-white text-xs font-medium rounded-full shadow-lg shadow-sand-500/25 transition-all btn-press"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Obra</span>
        </Link>
        <Link
          href="/leads"
          className="flex items-center gap-1.5 px-3 py-2 bg-ocean-500 hover:bg-ocean-600 text-white text-xs font-medium rounded-full shadow-lg shadow-ocean-500/25 transition-all btn-press"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Novo Lead</span>
        </Link>
      </div>
    </header>
  )
}
