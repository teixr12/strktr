import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  statusLabel?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, statusLabel, actions }: PageHeaderProps) {
  return (
    <div className="enterprise-page-header">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {statusLabel ? <span className="enterprise-status-chip">{statusLabel}</span> : null}
        {actions}
      </div>
    </div>
  )
}
