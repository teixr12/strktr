'use client'

import { RouteError } from '@/components/ui/route-error'

export default function NotificacoesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      context="carregando suas notificações"
      suggestion="Verifique sua conexão e tente novamente."
    />
  )
}
