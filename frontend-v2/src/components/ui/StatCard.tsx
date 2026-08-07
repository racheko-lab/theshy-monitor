import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { GlassCard } from './GlassCard'

type NumberTone = 'default' | 'primary' | 'success' | 'danger'

interface StatCardProps {
  label: string
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  icon?: LucideIcon
  hint?: string
  tone?: NumberTone
  /** 自定义内容（如时长文本），传入后覆盖 CountUp 数字 */
  children?: ReactNode
}

const toneClass: Record<NumberTone, string> = {
  default: 'text-text',
  primary: 'text-[var(--color-primary)]',
  success: 'text-[var(--color-success)]',
  danger: 'text-[var(--color-danger)]',
}

/** StatCard — 统计数字卡（CountUp 动画），用于 Dashboard 统计区 */
export function StatCard({
  label,
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  icon: Icon,
  hint,
  tone = 'default',
  children,
}: StatCardProps) {
  const ref = useCountUp(value, { decimals, prefix, suffix })
  return (
    <GlassCard className="p-6" data-stat-card>
      <div className="flex items-center justify-between">
        <span className="text-caption font-medium text-secondary">{label}</span>
        {Icon && <Icon size={16} className="text-secondary" />}
      </div>
      <div className={`mt-3 text-h2 font-semibold tabular-nums ${toneClass[tone]}`}>
        {children ?? <span ref={ref} />}
      </div>
      {hint && <div className="mt-1 text-xs text-tertiary">{hint}</div>}
    </GlassCard>
  )
}
