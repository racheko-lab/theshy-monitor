import type { ReactNode } from 'react'

export type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'neutral'

const toneClass: Record<Tone, string> = {
  primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
  danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  warning: 'bg-[rgba(251,191,36,0.12)] text-[var(--color-warning)]',
  neutral: 'bg-white/5 text-secondary',
}

interface BadgeProps {
  tone?: Tone
  children: ReactNode
  className?: string
}

/** Badge — 状态药丸（统一圆角/间距，引用 Token 配色） */
export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-medium ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
