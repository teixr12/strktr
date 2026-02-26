'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 p-6">
        <div className="max-w-xl mx-auto mt-16 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Algo deu errado</h2>
          <p className="text-sm text-gray-600 mt-2">
            O erro foi registrado. Tente novamente.
          </p>
          <button
            onClick={() => reset()}
            className="mt-4 px-4 py-2 rounded-xl bg-sand-500 text-white text-sm"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
