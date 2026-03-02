'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalSheetProps {
  /** Whether the modal is visible */
  open: boolean
  /** Called when the modal should close (backdrop click, close button, Escape key) */
  onClose: () => void
  /** Modal title displayed in the sticky header */
  title: string
  /** Modal content */
  children: React.ReactNode
  /** Max width class: 'md' (default) | 'lg' | 'xl' */
  maxWidth?: 'md' | 'lg' | 'xl'
}

const MAX_WIDTH_MAP = {
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
}

/**
 * Mobile-first modal that slides up from the bottom on small screens
 * and centers on desktop. Follows the `obra-form-modal.tsx` gold standard.
 *
 * Features:
 * - Bottom-sheet on mobile (rounded-t-3xl, items-end)
 * - Centered modal on desktop (rounded-3xl, items-center)
 * - Sticky header with title + close button
 * - Max-height 90vh with scroll
 * - Backdrop blur + click-to-close
 * - Escape key support
 */
export function ModalSheet({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
}: ModalSheetProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`modal-glass modal-animate w-full ${MAX_WIDTH_MAP[maxWidth]} rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="p-5 border-b border-gray-200/50 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur z-10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
