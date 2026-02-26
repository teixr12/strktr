import type { ReactNode } from 'react'

interface FilterBarProps {
  left?: ReactNode
  right?: ReactNode
}

export function FilterBar({ left, right }: FilterBarProps) {
  return (
    <div className="enterprise-card p-3 md:p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">{left}</div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </div>
  )
}
