import { useEffect, useRef } from 'react'

/**
 * 首次渲染返回 true，之后（提交后）返回 false。
 * 用于图表：首次播放入场动画，后续 30s 刷新仅更新数据、不重播整张动画。
 */
export function useFirstAnimation() {
  const firstRef = useRef(true)
  useEffect(() => {
    firstRef.current = false
  }, [])
  return firstRef
}
