import type { ReactNode } from 'react'

export type UiStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export type UiCardVariant = 'default' | 'soft' | 'elevated'
export type UiDensity = 'compact' | 'comfortable'
export type UiPriorityTone = 'critical' | 'attention' | 'normal' | 'done'
export type UiSurfaceVariant = 'solid' | 'soft' | 'outline'

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

export type ObraCardViewModel = {
  id: string
  title: string
  subtitle: string
  coverTone: 'sand' | 'ocean' | 'gray' | 'emerald'
  progress: number
  progressLabel: string
  statusLabel: string
  statusTone: UiPriorityTone
  areaLabel: string
  phaseLabel: string
  deliveryLabel: string
  valueLabel: string
  memberInitials: string[]
}

export type LeadLaneViewModel = {
  id: string
  title: string
  count: number
  tone: UiStatusTone
}

export type InteractionRowViewModel = {
  id: string
  clientName: string
  clientMeta: string
  originLabel: string
  statusLabel: string
  statusTone: UiStatusTone
  estimatedValueLabel: string
  lastContactLabel: string
}
