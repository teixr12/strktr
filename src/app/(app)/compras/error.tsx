'use client'

import { RouteError } from '@/components/ui/route-error'

export default function ComprasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      error={error}
      reset={reset}
      context="carregar suas compras"
      suggestion="Verifique sua conexão e tente novamente. Se o problema persistir, contate o suporte."
    />
  )
}
