import type { ReactNode } from 'react'

interface TagProps {
  children: ReactNode
  className?: string
}

/** Tag — 描边小标签（如「小号」），克制不抢眼 */
export function Tag({ children, className = '' }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border border-[var(--color-border-strong)] px-1.5 py-0.5 text-xs font-medium text-secondary ${className}`}
    >
      {children}
    </span>
  )
}
