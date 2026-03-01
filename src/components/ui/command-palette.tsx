'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutGrid,
  HardHat,
  FolderKanban,
  Crown,
  FileText,
  Wallet,
  Users,
  CalendarDays,
  ShoppingCart,
  Building2,
  BookOpen,
  Plus,
  User,
  Settings,
} from 'lucide-react'
import { featureFlags } from '@/lib/feature-flags'
import type { LucideIcon } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface PaletteItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  section: 'nav' | 'actions' | 'config'
}

const NAV_ITEMS: PaletteItem[] = [
  { id: 'dashboard', label: 'Vis\u00e3o Geral', href: '/dashboard', icon: LayoutGrid, section: 'nav' },
  { id: 'obras', label: 'Obras', href: '/obras', icon: HardHat, section: 'nav' },
  { id: 'projetos', label: 'Projetos', href: '/projetos', icon: FolderKanban, section: 'nav' },
  { id: 'leads', label: 'Leads VIP', href: '/leads', icon: Crown, section: 'nav' },
  { id: 'orcamentos', label: 'Or\u00e7amentos', href: '/orcamentos', icon: FileText, section: 'nav' },
  { id: 'financeiro', label: 'Financeiro', href: '/financeiro', icon: Wallet, section: 'nav' },
  { id: 'compras', label: 'Compras', href: '/compras', icon: ShoppingCart, section: 'nav' },
  { id: 'equipe', label: 'Equipe', href: '/equipe', icon: Users, section: 'nav' },
  { id: 'calendario', label: 'Agenda', href: '/calendario', icon: CalendarDays, section: 'nav' },
  { id: 'knowledgebase', label: 'Base de Conhecimento', href: '/knowledgebase', icon: BookOpen, section: 'nav' },
  { id: 'configuracoes', label: 'Configura\u00e7\u00f5es', href: '/configuracoes', icon: Building2, section: 'nav' },
]

const ACTION_ITEMS: PaletteItem[] = [
  { id: 'novo-lead', label: 'Novo Lead', href: '/leads', icon: Plus, section: 'actions' },
  { id: 'nova-obra', label: 'Nova Obra', href: '/obras', icon: Plus, section: 'actions' },
  { id: 'novo-orcamento', label: 'Novo Or\u00e7amento', href: '/orcamentos', icon: Plus, section: 'actions' },
]

const CONFIG_ITEMS: PaletteItem[] = [
  { id: 'perfil', label: 'Meu Perfil', href: '/perfil', icon: User, section: 'config' },
  { id: 'config', label: 'Configura\u00e7\u00f5es', href: '/configuracoes', icon: Settings, section: 'config' },
]

const ALL_ITEMS = [...NAV_ITEMS, ...ACTION_ITEMS, ...CONFIG_ITEMS]

const SECTION_LABELS: Record<string, string> = {
  nav: 'Navegar',
  actions: 'A\u00e7\u00f5es R\u00e1pidas',
  config: 'Configura\u00e7\u00e3o',
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommandPalette() {
  const enabled = featureFlags.cmdPalette

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  /* ---------- filtered results ---------- */
  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_ITEMS
    const q = query.toLowerCase()
    return ALL_ITEMS.filter((item) => item.label.toLowerCase().includes(q))
  }, [query])

  /* ---------- grouped for display ---------- */
  const grouped = useMemo(() => {
    const sections: { key: string; label: string; items: PaletteItem[] }[] = []
    const order = ['nav', 'actions', 'config'] as const
    for (const key of order) {
      const items = filtered.filter((i) => i.section === key)
      if (items.length > 0) {
        sections.push({ key, label: SECTION_LABELS[key], items })
      }
    }
    return sections
  }, [filtered])

  /* ---------- flat list for keyboard nav ---------- */
  const flatItems = useMemo(() => grouped.flatMap((s) => s.items), [grouped])

  /* ---------- toggle open/close ---------- */
  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        setQuery('')
        setSelectedIndex(0)
      }
      return !prev
    })
  }, [])

  /* ---------- navigate to item ---------- */
  const navigateTo = useCallback(
    (item: PaletteItem) => {
      setOpen(false)
      router.push(item.href)
    },
    [router]
  )

  /* ---------- keyboard shortcut: Cmd+K / Ctrl+K ---------- */
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggle, enabled])

  /* ---------- auto-focus input when open ---------- */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  /* ---------- reset selected index when results change ---------- */
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  /* ---------- scroll selected item into view ---------- */
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  /* ---------- feature flag guard (after all hooks) ---------- */
  if (!enabled) return null

  /* ---------- keyboard nav inside palette ---------- */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i < flatItems.length - 1 ? i + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i > 0 ? i - 1 : flatItems.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flatItems[selectedIndex]) {
        navigateTo(flatItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  if (!open) return null

  /* ---------- render ---------- */
  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="mx-auto mt-[15vh] w-full max-w-xl modal-glass modal-animate rounded-2xl overflow-hidden shadow-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-gray-200/70 dark:border-gray-800 px-5">
          <Search className="h-5 w-5 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar p\u00e1ginas, a\u00e7\u00f5es..."
            className="w-full bg-transparent py-4 text-lg text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100 dark:placeholder-gray-500"
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              Nenhum resultado
            </div>
          ) : (
            grouped.map((section) => (
              <div key={section.key}>
                <div className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {section.label}
                </div>
                {section.items.map((item) => {
                  const idx = runningIndex++
                  const isSelected = idx === selectedIndex
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => navigateTo(item)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-gray-100 dark:bg-gray-800'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-gray-400" />
                      <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-gray-200/70 px-5 py-2.5 text-[11px] text-gray-400 dark:border-gray-800">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 px-1 py-0.5 font-semibold dark:bg-gray-800">&uarr;</kbd>
            <kbd className="rounded bg-gray-100 px-1 py-0.5 font-semibold dark:bg-gray-800">&darr;</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 px-1 py-0.5 font-semibold dark:bg-gray-800">&crarr;</kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-gray-100 px-1 py-0.5 font-semibold dark:bg-gray-800">esc</kbd>
            fechar
          </span>
        </div>
      </div>
    </div>
  )
}
