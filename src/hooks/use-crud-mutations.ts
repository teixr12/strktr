'use client'

import { useMutation } from './use-mutation'
import type { AnalyticsSource } from '@/shared/types/analytics'

interface CrudMutationsConfig<TItem extends { id: string }> {
  /** React state setter for the items array */
  setItems: React.Dispatch<React.SetStateAction<TItem[]>>
  /** Base API path, e.g. '/api/v1/leads' */
  basePath: string
  /** Human-readable entity name for toast messages, e.g. 'Lead' */
  entityName: string
  /** Analytics source, e.g. 'leads' */
  trackSource: AnalyticsSource
  /** Analytics entity type, e.g. 'lead' */
  trackEntityType: string
  /** Called after any mutation settles — e.g., refresh pagination */
  onSettled?: () => void | Promise<void>
}

/**
 * Pre-configured CRUD mutation hooks for standard entity management.
 *
 * @example
 * const { createMutation, updateMutation, deleteMutation } = useCrudMutations<Lead>({
 *   setItems: setLeads,
 *   basePath: '/api/v1/leads',
 *   entityName: 'Lead',
 *   trackSource: 'leads',
 *   trackEntityType: 'lead',
 * })
 *
 * // Create — prepends to list
 * await createMutation.mutate(payload)
 *
 * // Update — replaces item in list
 * await updateMutation.mutate(payload, itemId)
 *
 * // Delete — optimistically removes from list, rolls back on error
 * await deleteMutation.mutate(undefined, itemId)
 */
export function useCrudMutations<TItem extends { id: string }>(
  config: CrudMutationsConfig<TItem>
) {
  const createMutation = useMutation<TItem>(config.setItems, {
    method: 'POST',
    path: config.basePath,
    onSuccess: (prev, result) => [result as unknown as TItem, ...prev],
    successMessage: `${config.entityName} criado!`,
    errorMessage: `Erro ao criar ${config.entityName.toLowerCase()}`,
    trackEvent: 'core_create',
    trackSource: config.trackSource,
    trackEntityType: config.trackEntityType,
    onSettled: config.onSettled,
  })

  const updateMutation = useMutation<TItem>(config.setItems, {
    method: 'PUT',
    path: (id) => `${config.basePath}/${id}`,
    onSuccess: (prev, result, id) =>
      prev.map((item) => (item.id === id ? (result as unknown as TItem) : item)),
    successMessage: `${config.entityName} atualizado!`,
    errorMessage: `Erro ao atualizar ${config.entityName.toLowerCase()}`,
    trackEvent: 'core_edit',
    trackSource: config.trackSource,
    trackEntityType: config.trackEntityType,
    onSettled: config.onSettled,
  })

  const deleteMutation = useMutation<TItem>(config.setItems, {
    method: 'DELETE',
    path: (id) => `${config.basePath}/${id}`,
    optimisticUpdate: (prev, _payload, id) =>
      prev.filter((item) => item.id !== id),
    successMessage: `${config.entityName} excluído`,
    errorMessage: `Erro ao excluir ${config.entityName.toLowerCase()}`,
    trackEvent: 'core_delete',
    trackSource: config.trackSource,
    trackEntityType: config.trackEntityType,
    onSettled: config.onSettled,
  })

  return { createMutation, updateMutation, deleteMutation }
}
