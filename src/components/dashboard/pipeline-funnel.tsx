'use client'

import { fmt } from '@/lib/utils'

interface FunnelStage {
  id: string
  label: string
  count: number
  total: number
  dot: string
}

interface PipelineFunnelProps {
  stages: FunnelStage[]
}

export function PipelineFunnel({ stages }: PipelineFunnelProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const width = Math.max((stage.count / maxCount) * 100, 8)
        const prevCount = i > 0 ? stages[i - 1].count : null
        const conversionRate =
          prevCount && prevCount > 0
            ? Math.round((stage.count / prevCount) * 100)
            : null

        return (
          <div key={stage.id} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: stage.dot }}
                />
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {stage.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {conversionRate !== null && (
                  <span className="text-gray-400 dark:text-gray-500">
                    {conversionRate}%
                  </span>
                )}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {stage.count}
                </span>
              </div>
            </div>
            <div className="h-6 rounded-lg bg-gray-100 dark:bg-gray-800/60">
              <div
                className="flex h-6 items-center rounded-lg px-2 transition-all duration-500"
                style={{
                  width: `${width}%`,
                  background: stage.dot,
                  opacity: 0.75,
                }}
              >
                {stage.total > 0 && width > 25 && (
                  <span className="text-[10px] font-semibold text-white">
                    {fmt(stage.total)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
