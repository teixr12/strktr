'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { Menu, Sun, Moon, Plus } from 'lucide-react'
import { NotificationBell } from './notification-bell'
import { featureFlags } from '@/lib/feature-flags'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Visão Geral da Operação',
  '/obras': 'Obras em Andamento',
  '/projetos': 'Projetos',
  '/leads': 'Leads VIP',
  '/orcamentos': 'Orçamentos',
  '/financeiro': 'Financeiro',
  '/compras': 'Compras',
  '/equipe': 'Equipe',
  '/calendario': 'Agenda',
  '/perfil': 'Meu Perfil',
  '/knowledgebase': 'Base de Conhecimento',
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

  if (!featureFlags.uiTailadminV1) {
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
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500"
          >
            <Sun className="w-5 h-5 hidden dark:block" />
            <Moon className="w-5 h-5 block dark:hidden" />
          </button>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-gray-200/70 bg-white/85 px-4 backdrop-blur md:px-7 dark:border-gray-800 dark:bg-gray-950/85">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <span className="hidden md:inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Sistema Online
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Sun className="w-4 h-4 hidden dark:block" />
          <Moon className="w-4 h-4 block dark:hidden" />
        </button>
        <Link
          href="/leads"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-2xl bg-sand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sand-600"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </Link>
        <NotificationBell />
      </div>
    </header>
  )
}
