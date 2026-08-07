import { useEffect, useRef } from 'react'
import { CountUp } from 'countup.js'

// ============================================================
// useCountUp — 数字滚动动画（ease-out，1.5s）
// 数值变化时从上一显示值平滑过渡到新值。
// ============================================================

interface CountUpOptions {
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export function useCountUp(value: number, options: CountUpOptions = {}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef<number>(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const anim = new CountUp(el, value, {
      startVal: prev.current,
      duration: options.duration ?? 1.5,
      decimalPlaces: options.decimals ?? 0,
      prefix: options.prefix ?? '',
      suffix: options.suffix ?? '',
      useEasing: true,
    })
    if (!anim.error) {
      anim.start()
    } else {
      el.textContent = `${options.prefix ?? ''}${value}${options.suffix ?? ''}`
    }
    prev.current = value
  }, [value, options.duration, options.decimals, options.prefix, options.suffix])

  return ref
}
