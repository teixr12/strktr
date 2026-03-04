'use client'

import type { ReactNode } from 'react'
import { EmptyStateAction } from '@/components/ui/enterprise/empty-state-action'
import { PageSkeleton } from '@/components/ui/enterprise/page-skeleton'

type AsyncStateBoundaryProps = {
  isLoading: boolean
  error: string | null
  isEmpty: boolean
  children: ReactNode
  onRetry?: () => void
  loadingVariant?: 'dashboard' | 'list' | 'grid' | 'detail' | 'kanban'
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
}

export function AsyncStateBoundary({
  isLoading,
  error,
  isEmpty,
  children,
  onRetry,
  loadingVariant = 'list',
  emptyTitle = 'Sem dados para exibir',
  emptyDescription = 'Quando houver dados, eles aparecerão aqui.',
  emptyActionLabel = 'Atualizar',
}: AsyncStateBoundaryProps) {
  if (isLoading) {
    return <PageSkeleton variant={loadingVariant} />
  }

  if (error) {
    return (
      <EmptyStateAction
        title="Erro ao carregar"
        description={error}
        actionLabel="Tentar novamente"
        onAction={onRetry}
      />
    )
  }

  if (isEmpty) {
    return (
      <EmptyStateAction
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onRetry}
      />
    )
  }

  return <>{children}</>
}
