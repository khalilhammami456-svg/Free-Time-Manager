import type { ReactNode } from 'react'

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-sm',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
