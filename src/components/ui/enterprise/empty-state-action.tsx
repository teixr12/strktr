import Link from 'next/link'
import type { ReactNode } from 'react'

interface EmptyStateActionProps {
  icon?: ReactNode
  title: string
  description: string
  actionLabel: string
  actionHref?: string
  onAction?: () => void
}

export function EmptyStateAction({ icon, title, description, actionLabel, actionHref, onAction }: EmptyStateActionProps) {
  return (
    <div className="enterprise-card p-6 text-center">
      {icon ? <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sand-100 dark:bg-sand-900/30">{icon}</div> : null}
      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600"
        >
          {actionLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-600"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
