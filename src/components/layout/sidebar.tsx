'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import {
  LayoutGrid,
  HardHat,
  Crown,
  FileText,
  Wallet,
  Users,
  CalendarDays,
  FolderKanban,
  ShoppingCart,
  Settings,
  LogOut,
  X,
  Building2,
  BookOpen,
} from 'lucide-react'
import type { Profile } from '@/types/database'
import { featureFlags } from '@/lib/feature-flags'
import { apiRequest } from '@/lib/api/client'
import type { UiAvatarSource, UiNavCounts } from '@/shared/types/ui'

const icons = {
  LayoutGrid,
  HardHat,
  Crown,
  FileText,
  Wallet,
  Users,
  CalendarDays,
  FolderKanban,
  ShoppingCart,
  Building2,
  BookOpen,
} as const

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'LayoutGrid' as const, href: '/dashboard' },
  { id: 'obras', label: 'Obras', icon: 'HardHat' as const, href: '/obras' },
  { id: 'projetos', label: 'Projetos', icon: 'FolderKanban' as const, href: '/projetos' },
  { id: 'leads', label: 'Leads VIP', icon: 'Crown' as const, href: '/leads' },
  { id: 'orcamentos', label: 'Orçamentos', icon: 'FileText' as const, href: '/orcamentos' },
  { id: 'financeiro', label: 'Financeiro', icon: 'Wallet' as const, href: '/financeiro' },
  { id: 'compras', label: 'Compras', icon: 'ShoppingCart' as const, href: '/compras' },
  { id: 'equipe', label: 'Equipe', icon: 'Users' as const, href: '/equipe' },
  { id: 'calendario', label: 'Agenda', icon: 'CalendarDays' as const, href: '/calendario' },
  { id: 'knowledgebase', label: 'Base de Conhecimento', icon: 'BookOpen' as const, href: '/knowledgebase' },
  { id: 'configuracoes', label: 'Configurações', icon: 'Building2' as const, href: '/configuracoes' },
]

const INTEGRATIONS = ['WhatsApp Business', 'Google Calendar', 'Sicoob API']

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [navCounts, setNavCounts] = useState<UiNavCounts | null>(null)
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) setProfile(data)
      }
    }

    async function loadNavCounts() {
      if (!featureFlags.navCountsV2) {
        setNavCounts(null)
        return
      }
      try {
        const counts = await apiRequest<UiNavCounts>('/api/v1/dashboard/nav-counts')
        setNavCounts(counts)
      } catch {
        setNavCounts(null)
      }
    }

    loadProfile()
    loadNavCounts()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    profile?.nome || 'U'
  )}&background=d4a373&color=fff`
  const customAvatar = profile?.avatar_url?.trim() || null
  const canUseCustomAvatar =
    featureFlags.profileAvatarV2 &&
    Boolean(customAvatar?.startsWith('http')) &&
    customAvatar !== failedAvatarSrc
  const avatarSrc = canUseCustomAvatar ? customAvatar! : fallbackAvatar
  const avatarSource: UiAvatarSource =
    canUseCustomAvatar ? 'profile' : 'fallback'

  const chipsByItem: Partial<Record<(typeof NAV_ITEMS)[number]['id'], string>> = {}
  if (featureFlags.navCountsV2 && navCounts) {
    if ((navCounts.obras_ativas ?? 0) > 0) chipsByItem.obras = String(navCounts.obras_ativas)
    if ((navCounts.leads_hot ?? 0) > 0) chipsByItem.leads = `${navCounts.leads_hot} Hot`
    if ((navCounts.compras_pendentes_aprovacao ?? 0) > 0) {
      chipsByItem.compras = String(navCounts.compras_pendentes_aprovacao)
    }
  }

  if (!featureFlags.uiTailadminV1) {
    return (
      <>
        {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={onClose} />}
        <aside
          className={`fixed md:relative inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col z-50 transform transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0`}
        >
          <div className="p-5 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/strktr-logo-black.png" alt="STRKTR" width={120} height={22} className="dark:hidden" />
              <Image src="/strktr-logo-white.png" alt="STRKTR" width={120} height={22} className="hidden dark:block" />
            </div>
            <button onClick={onClose} className="md:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
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
        </aside>
      </>
    )
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-gray-200/70 bg-white/95 backdrop-blur transition-transform duration-300 md:relative md:translate-x-0 dark:border-gray-800 dark:bg-gray-950/95 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200/70 px-5 py-5 dark:border-gray-800">
          <div className="flex items-center">
            <Image
              src="/strktr-logo-black.png"
              alt="STRKTR"
              width={136}
              height={26}
              className="dark:hidden"
            />
            <Image
              src="/strktr-logo-white.png"
              alt="STRKTR"
              width={136}
              height={26}
              className="hidden dark:block"
            />
          </div>
          <button onClick={onClose} className="rounded-xl p-2 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = icons[item.icon]
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const chip = chipsByItem[item.id]
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                    isActive
                      ? 'bg-sand-100 text-sand-800 dark:bg-sand-900/40 dark:text-sand-200'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {chip ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.id === 'leads' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                      {chip}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </div>

          <div className="mt-6 border-t border-gray-200/80 pt-5 dark:border-gray-800">
            <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Integrações disponíveis</p>
            <div className="space-y-2 px-2">
              {INTEGRATIONS.map((integration) => (
                <div key={integration} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span className="flex-1">{integration}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Conectável
                  </span>
                </div>
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-gray-200/70 p-4 dark:border-gray-800">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 dark:bg-gray-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc}
              alt="Avatar"
              className="h-10 w-10 rounded-full object-cover"
              onError={() => setFailedAvatarSrc(customAvatar)}
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{profile?.nome || 'Usuário'}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {profile?.email || ''}
                {avatarSource === 'fallback' ? '' : ' · Foto'}
              </p>
            </div>
            <Link href="/perfil" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800">
              <Settings className="h-4 w-4" />
            </Link>
            <button onClick={handleLogout} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
