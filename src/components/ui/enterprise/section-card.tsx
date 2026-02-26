import type { ReactNode } from 'react'
import type { UiCardVariant } from '@/shared/types/ui'

interface SectionCardProps {
  title?: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
  variant?: UiCardVariant
}

const VARIANT_CLASS: Record<UiCardVariant, string> = {
  default: 'enterprise-card',
  soft: 'enterprise-card enterprise-card-soft',
  elevated: 'enterprise-card enterprise-card-elevated',
}

export function SectionCard({ title, subtitle, right, children, className = '', variant = 'default' }: SectionCardProps) {
  return (
    <section className={`${VARIANT_CLASS[variant]} ${className}`.trim()}>
      {title || right ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  )
}
