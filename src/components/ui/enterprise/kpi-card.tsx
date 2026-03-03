import { memo, type ReactNode } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'

interface KpiCardProps {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  trend?: string
  progress?: number
  accent?: 'sand' | 'ocean' | 'emerald' | 'violet'
  href?: string
  drilldownLabel?: string
  sparkline?: number[]
}

const ACCENT_CLASS = {
  sand: 'from-sand-500/25 to-sand-500/5',
  ocean: 'from-ocean-500/25 to-ocean-500/5',
  emerald: 'from-emerald-500/25 to-emerald-500/5',
  violet: 'from-violet-500/25 to-violet-500/5',
}

const SPARKLINE_STROKE = {
  sand: '#d4a373',
  ocean: '#0ea5e9',
  emerald: '#10b981',
  violet: '#8b5cf6',
}

export const KpiCard = memo(function KpiCard({
  icon,
  label,
  value,
  hint,
  trend,
  progress,
  accent = 'sand',
  href,
  drilldownLabel = 'Ver detalhes',
  sparkline,
}: KpiCardProps) {
  return (
    <article className="enterprise-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${ACCENT_CLASS[accent]}`}>
          {icon}
        </div>
        {trend ? <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{trend}</span> : null}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <p>{label}</p>
        {hint ? (
          <span title={hint} aria-label={hint}>
            <Info className="h-3.5 w-3.5 text-gray-400" />
          </span>
        ) : null}
      </div>
      {sparkline && sparkline.length > 1 ? (
        <svg viewBox="0 0 64 24" className="mt-2 h-6 w-16" aria-hidden="true">
          <polyline
            fill="none"
            stroke={SPARKLINE_STROKE[accent]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={sparkline
              .map((v, i) => {
                const max = Math.max(...sparkline)
                const y = max > 0 ? 24 - (v / max) * 20 : 12
                return `${(i / (sparkline.length - 1)) * 64},${y}`
              })
              .join(' ')}
          />
        </svg>
      ) : null}
      {typeof progress === 'number' ? (
        <div className="mt-4 h-2 rounded-full bg-gray-200/80 dark:bg-gray-800/80">
          <div className="h-2 rounded-full bg-gradient-to-r from-sand-500 to-ocean-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
      {href ? (
        <div className="mt-3">
          <Link
            href={href}
            className="text-xs font-semibold text-sand-700 underline-offset-2 hover:underline dark:text-sand-300"
          >
            {drilldownLabel}
          </Link>
        </div>
      ) : null}
    </article>
  )
})
