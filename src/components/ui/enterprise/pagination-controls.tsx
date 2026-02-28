type PaginationControlsProps = {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  isLoading?: boolean
  onPrev: () => void
  onNext: () => void
}

export function PaginationControls({
  page,
  pageSize,
  total,
  hasMore,
  isLoading = false,
  onPrev,
  onNext,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-col gap-2 border-t border-gray-200/70 px-1 pt-3 text-xs text-gray-500 dark:border-gray-700/70 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Mostrando {from}-{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide">Página {page}/{totalPages}</span>
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1 || isLoading}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasMore || isLoading}
          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Próxima
        </button>
      </div>
    </div>
  )
}
