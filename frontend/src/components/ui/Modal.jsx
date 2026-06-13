import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]',
  }[size] || 'max-w-2xl'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box ${sizeClass}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="h3">{title}</h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-t3 hover:text-t hover:bg-surface-h transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
