import type { ReactNode } from 'react'
import { GlassCard } from './GlassCard'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

/** ChartCard — 图表容器，统一标题/留白/玻璃质感 */
export function ChartCard({ title, subtitle, children, className = '' }: ChartCardProps) {
  return (
    <GlassCard className={`flex flex-col p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-h3 text-text">{title}</h3>
        {subtitle && <p className="mt-1 text-caption text-secondary">{subtitle}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </GlassCard>
  )
}
