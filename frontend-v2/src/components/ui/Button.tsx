import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  active?: boolean
}

/** Button — 极简幽灵按钮（刷新/粒子开关等），引用 Token */
export function Button({
  children,
  active = false,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-caption font-medium transition-colors duration-200 ${
        active
          ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
          : 'border-[var(--color-border-strong)] text-secondary hover:bg-white/5 hover:text-text'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
