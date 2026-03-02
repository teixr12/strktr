'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps page content with an entry animation that re-triggers on route change.
 * Uses `key={pathname}` to force React to unmount/remount on navigation,
 * re-triggering the CSS animation.
 *
 * The animation uses GPU-composited `opacity` + `transform` properties
 * to avoid layout shifts.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  )
}
