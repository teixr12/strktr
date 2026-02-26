'use client'

export function toast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  const t = document.createElement('div')
  t.className = `toast toast-${type}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3500)
}
