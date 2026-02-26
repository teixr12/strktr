import type { ReactNode } from 'react'

export type UiStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export type UiCardVariant = 'default' | 'soft' | 'elevated'

export type UiQuickAction = {
  label: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
  tone?: UiStatusTone
}

export type UiDataColumn<T> = {
  key: string
  header: string
  className?: string
  cell: (row: T) => ReactNode
}
