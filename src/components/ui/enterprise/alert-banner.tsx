import type { ReactNode } from 'react'
import type { UiStatusTone } from '@/shared/types/ui'

interface AlertBannerProps {
  title: string
  description?: string
  action?: ReactNode
  tone?: UiStatusTone
}

const TONE_CLASS: Record<UiStatusTone, string> = {
  neutral: 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900',
  success: 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-900/20',
  warning: 'border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-900/20',
  danger: 'border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-900/20',
  info: 'border-blue-300 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-900/20',
}

export function AlertBanner({ title, description, action, tone = 'warning' }: AlertBannerProps) {
  return (
    <div className={`rounded-2xl border px-4 py-3 md:px-5 md:py-4 ${TONE_CLASS[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          {description ? <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{description}</p> : null}
        </div>
        {action}
      </div>
    </div>
  )
}
