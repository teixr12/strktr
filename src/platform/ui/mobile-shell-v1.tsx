'use client'

import type { ReactNode } from 'react'
import { featureFlags } from '@/lib/feature-flags'

type MobileShellV1Props = {
  children: ReactNode
  primaryAction?: ReactNode
}

export function MobileShellV1({ children, primaryAction }: MobileShellV1Props) {
  if (!featureFlags.mobileUxV1 || !primaryAction) {
    return <>{children}</>
  }

  return (
    <div className="pb-24 md:pb-0">
      {children}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200/70 bg-white/95 px-4 py-3 backdrop-blur md:hidden dark:border-gray-800/70 dark:bg-gray-950/95">
        {primaryAction}
      </div>
    </div>
  )
}
