import type { ReactNode } from 'react'

interface KpiCardProps {
  icon: ReactNode
  label: string
  value: string
  trend?: string
  progress?: number
  accent?: 'sand' | 'ocean' | 'emerald' | 'violet'
}

const ACCENT_CLASS = {
  sand: 'from-sand-500/25 to-sand-500/5',
  ocean: 'from-ocean-500/25 to-ocean-500/5',
  emerald: 'from-emerald-500/25 to-emerald-500/5',
  violet: 'from-violet-500/25 to-violet-500/5',
}

export function KpiCard({ icon, label, value, trend, progress, accent = 'sand' }: KpiCardProps) {
  return (
    <article className="enterprise-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_CLASS[accent]}`}>
          {icon}
        </div>
        {trend ? <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{trend}</span> : null}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
      {typeof progress === 'number' ? (
        <div className="mt-4 h-2 rounded-full bg-gray-200/80 dark:bg-gray-800/80">
          <div className="h-2 rounded-full bg-gradient-to-r from-sand-500 to-ocean-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </article>
  )
}
