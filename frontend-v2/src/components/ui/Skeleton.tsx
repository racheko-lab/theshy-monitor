interface SkeletonProps {
  className?: string
}

/** Skeleton — 加载占位（微光），统一圆角 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-white/5 ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 37%, rgba(255,255,255,0.03) 63%)',
        backgroundSize: '400% 100%',
        animation: 'skeleton 1.4s ease infinite',
      }}
    />
  )
}
