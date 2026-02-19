'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Algo deu errado</h2>
        <p className="text-sm text-gray-500 mb-4">Ocorreu um erro inesperado. Tente novamente.</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-full transition-all btn-press text-sm"
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  )
}
