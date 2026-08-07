import { useRef } from 'react'
import { useInView as useFramerInView, type UseInViewOptions } from 'framer-motion'

// ============================================================
// useInView — 滚动进入视口检测（once: 触发一次即锁定）
// 用于滚动触发的进入动画，避免重复播放。
// ============================================================

export function useInView<T extends HTMLElement = HTMLDivElement>(
  margin: UseInViewOptions['margin'] = '-10% 0px -10% 0px',
) {
  const ref = useRef<T>(null)
  const inView = useFramerInView(ref, { once: true, margin })
  return [ref, inView] as const
}
