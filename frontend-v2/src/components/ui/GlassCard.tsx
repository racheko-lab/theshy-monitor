import { motion, type HTMLMotionProps } from 'framer-motion'
import { cardHover } from '@/constants'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  /** 是否启用 Hover 浮起（VisionOS 风格） */
  hover?: boolean
}

/**
 * GlassCard — 统一毛玻璃容器。
 * 所有卡片/面板复用此组件，禁止自行写 background/backdrop-filter。
 */
export function GlassCard({
  hover = true,
  className = '',
  children,
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      initial={hover ? 'rest' : false}
      animate={hover ? 'rest' : undefined}
      whileHover={hover ? 'hover' : undefined}
      variants={hover ? cardHover : undefined}
      className={`glass rounded-lg ${hover ? 'glass-hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
