'use client'

import { useEffect } from 'react'

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  opts?: { metaKey?: boolean; ctrlKey?: boolean }
) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (opts?.metaKey && !e.metaKey) return
      if (opts?.ctrlKey && !e.ctrlKey) return
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault()
        callback()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, callback, opts?.metaKey, opts?.ctrlKey])
}
