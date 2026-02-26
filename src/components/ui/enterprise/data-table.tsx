import type { UiDataColumn, UiDensity } from '@/shared/types/ui'

interface DataTableProps<T> {
  columns: UiDataColumn<T>[]
  rows: T[]
  emptyMessage?: string
  density?: UiDensity
}

export function DataTable<T>({ columns, rows, emptyMessage = 'Sem dados', density = 'comfortable' }: DataTableProps<T>) {
  const cellClass = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 dark:border-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50/80 dark:bg-gray-900/50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`${cellClass} text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${column.className || ''}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/60">
                  {columns.map((column) => (
                    <td key={column.key} className={`${cellClass} text-sm text-gray-700 dark:text-gray-300 ${column.className || ''}`}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
