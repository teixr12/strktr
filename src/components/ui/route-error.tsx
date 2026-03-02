'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface RouteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  /** Route-specific context shown to user (e.g., "carregando seus leads") */
  context?: string
  /** Route-specific recovery suggestions */
  suggestion?: string
}

export function RouteError({ error, reset, context, suggestion }: RouteErrorProps) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: 'route-error' } })
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl" role="img" aria-label="erro">!</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Algo deu errado
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
          {context
            ? `Ocorreu um erro ao ${context}.`
            : 'Ocorreu um erro inesperado.'}
        </p>
        {suggestion && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{suggestion}</p>
        )}
        {!suggestion && <div className="mb-4" />}
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 font-mono">
            Ref: {error.digest}
          </p>
        )}
        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-sand-500 hover:bg-sand-600 text-white font-medium rounded-full transition-all btn-press text-sm"
          >
            Tentar Novamente
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-full transition-all text-sm"
          >
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
