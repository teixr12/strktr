'use client'

import { useCallback, useState, createElement } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions
  resolve: ((value: boolean) => void) | null
}

const INITIAL_STATE: ConfirmState = { open: false, options: { title: '' }, resolve: null }

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setState((prev) => {
      prev.resolve?.(true)
      return { ...prev, open: false, resolve: null }
    })
  }, [])

  const handleCancel = useCallback(() => {
    setState((prev) => {
      prev.resolve?.(false)
      return { ...prev, open: false, resolve: null }
    })
  }, [])

  const dialog = state.open
    ? createElement(ConfirmDialog, {
        title: state.options.title,
        description: state.options.description,
        confirmLabel: state.options.confirmLabel,
        cancelLabel: state.options.cancelLabel,
        variant: state.options.variant,
        onConfirm: handleConfirm,
        onCancel: handleCancel,
      })
    : null

  return { confirm, dialog }
}
