import { useEffect, useRef, useState } from 'react'

/**
 * 进入视口检测（IntersectionObserver）。
 * 返回 [ref, inView]：元素进入视口后将 inView 置 true 并停止观察。
 * 不支持 IntersectionObserver 的环境（或 SSR）直接返回 inView=true，保证图表始终挂载。
 */
export function useInView<T extends HTMLElement>(
  options?: IntersectionObserverInit,
): readonly [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      options ?? { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [options])

  return [ref, inView] as const
}
