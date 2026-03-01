'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { AppShell } from '@/components/ui/enterprise'
import { featureFlags } from '@/lib/feature-flags'
import { ToastProvider } from '@/components/ui/toast-provider'
import { CommandPalette } from '@/components/ui/command-palette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const useEnterpriseShell = featureFlags.uiTailadminV1

  if (!useEnterpriseShell) {
    return (
      <>
        <div className="h-screen flex flex-col md:flex-row">
          <Sidebar
            mobileOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
          <main className="flex-1 flex flex-col min-w-0 bg-gray-50/50 dark:bg-black relative overflow-hidden">
            <Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
            <div className="flex-1 overflow-y-auto">
              {children}
              <Footer />
            </div>
          </main>
        </div>
        <ToastProvider />
        <CommandPalette />
      </>
    )
  }

  return (
    <>
      <AppShell
        sidebar={(
          <Sidebar
            mobileOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
          />
        )}
        header={<Header onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />}
        footer={<Footer />}
      >
        {children}
      </AppShell>
      <ToastProvider />
      <CommandPalette />
    </>
  )
}
