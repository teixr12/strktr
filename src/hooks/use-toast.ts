'use client'

import { createContext, useContext } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastDispatch = (msg: string, type?: ToastType) => void

export const ToastContext = createContext<ToastDispatch | null>(null)

let _dispatch: ToastDispatch | null = null

export function setToastDispatch(fn: ToastDispatch | null) {
  _dispatch = fn
}

export function toast(msg: string, type: ToastType = 'success') {
  if (_dispatch) {
    _dispatch(msg, type)
  }
  // Silent no-op if provider not mounted (SSR or pre-hydration)
}

export function useToast() {
  const dispatch = useContext(ToastContext)
  return dispatch ?? toast
}
