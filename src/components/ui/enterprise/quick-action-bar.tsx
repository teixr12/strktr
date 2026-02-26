import Link from 'next/link'
import type { UiQuickAction } from '@/shared/types/ui'

interface QuickActionBarProps {
  actions: UiQuickAction[]
}

const TONE_CLASS = {
  neutral: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-sand-500 text-white hover:bg-sand-600',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  info: 'bg-ocean-600 text-white hover:bg-ocean-700',
}

export function QuickActionBar({ actions }: QuickActionBarProps) {
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action, idx) => {
        const tone = action.tone || 'warning'
        const className = `inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${TONE_CLASS[tone]}`

        if (action.href) {
          return (
            <Link key={`${action.label}-${idx}`} href={action.href} className={className}>
              {action.icon ? <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center">{action.icon}</span> : null}
              {action.label}
            </Link>
          )
        }

        return (
          <button key={`${action.label}-${idx}`} type="button" className={className} onClick={action.onClick}>
            {action.icon ? <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center">{action.icon}</span> : null}
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
