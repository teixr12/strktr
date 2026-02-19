'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutGrid,
  HardHat,
  Crown,
  FileText,
  Wallet,
  Users,
  CalendarDays,
  Waves,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import type { Profile } from '@/types/database'

const icons = {
  LayoutGrid,
  HardHat,
  Crown,
  FileText,
  Wallet,
  Users,
  CalendarDays,
} as const

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'LayoutGrid' as const, href: '/dashboard' },
  { id: 'obras', label: 'Obras', icon: 'HardHat' as const, href: '/obras' },
  { id: 'leads', label: 'Leads VIP', icon: 'Crown' as const, href: '/leads' },
  { id: 'orcamentos', label: 'Orçamentos', icon: 'FileText' as const, href: '/orcamentos' },
  { id: 'financeiro', label: 'Financeiro', icon: 'Wallet' as const, href: '/financeiro' },
  { id: 'equipe', label: 'Equipe', icon: 'Users' as const, href: '/equipe' },
  { id: 'calendario', label: 'Agenda', icon: 'CalendarDays' as const, href: '/calendario' },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        if (data) setProfile(data)
      }
    }
    loadProfile()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col z-50 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sand-400 to-sand-600 flex items-center justify-center shadow-lg">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-base tracking-tight text-gray-900 dark:text-white">
                STRKTR
              </h1>
              <p className="text-[10px] text-sand-600 dark:text-sand-400 font-medium">
                Premium
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = icons[item.icon]
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={`nav-item w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-apple text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  isActive ? 'active' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50">
          <div className="glass-card p-3 rounded-2xl flex items-center gap-3">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                profile?.nome || 'U'
              )}&background=d4a373&color=fff`}
              alt="Avatar"
              className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-700 shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {profile?.nome || '—'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {profile?.email || ''}
              </p>
            </div>
            <div className="flex gap-1">
              <Link
                href="/perfil"
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
