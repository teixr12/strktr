'use client'

import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

interface VirtualizedListProps<T> {
  items: T[]
  rowHeight: number
  containerHeight: number
  overscan?: number
  getKey: (item: T, index: number) => string
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

export function VirtualizedList<T>({
  items,
  rowHeight,
  containerHeight,
  overscan = 4,
  getKey,
  renderItem,
  className,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)

  const totalHeight = items.length * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  )
  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  )

  return (
    <div
      className={className}
      style={{ maxHeight: containerHeight, overflowY: 'auto' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * rowHeight}px)`,
          }}
        >
          {visibleItems.map((item, localIndex) => {
            const index = startIndex + localIndex
            return (
              <div key={getKey(item, index)} style={{ minHeight: rowHeight }}>
                {renderItem(item, index)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
