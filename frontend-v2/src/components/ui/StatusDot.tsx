interface StatusDotProps {
  /** live=红(直播中) / online=绿 / delayed=琥珀(延迟) / offline=灰 */
  state: 'live' | 'online' | 'delayed' | 'offline'
  className?: string
}

const color: Record<StatusDotProps['state'], string> = {
  live: 'var(--color-danger)',
  online: 'var(--color-success)',
  delayed: 'var(--color-warning)',
  offline: 'var(--color-text-tertiary)',
}

/** StatusDot — 状态指示点，live/online/delayed 带呼吸脉冲 */
export function StatusDot({ state, className = '' }: StatusDotProps) {
  const c = color[state]
  const pulse = state !== 'offline'
  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
          style={{ backgroundColor: c, animationDuration: '2.4s' }}
        />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }}
      />
    </span>
  )
}
