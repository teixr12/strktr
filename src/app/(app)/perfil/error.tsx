'use client'

import { RouteError } from '@/components/ui/route-error'

export default function PerfilError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      context="carregar seu perfil"
      suggestion="Verifique sua conexão e tente novamente. Se o problema persistir, contate o suporte."
    />
  )
}
