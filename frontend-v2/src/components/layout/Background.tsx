import { useEffect, useRef } from 'react'

interface BackgroundProps {
  /** 星空粒子开关（可在 Hero 中关闭） */
  particles?: boolean
}

/**
 * Background — 动态渐变光晕 + 星空粒子 + 顶部暗角。
 * 固定全屏、置于内容之后；粒子用 Canvas 实现，性能友好。
 */
export function Background({ particles = true }: BackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!particles) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cv = canvas
    let w = 0
    let h = 0
    let raf = 0
    type Star = { x: number; y: number; r: number; tw: number; sp: number }
    let stars: Star[] = []

    function resize() {
      w = cv.clientWidth
      h = cv.clientHeight
      cv.width = w * dpr
      cv.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(90, Math.floor((w * h) / 16000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        tw: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.6 + 0.2,
      }))
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, w, h)
      for (const s of stars) {
        const a = 0.35 + 0.4 * Math.sin(s.tw + t * 0.001 * s.sp)
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
        ctx!.fill()
        if (!reduce) {
          s.y += s.sp * 0.12
          if (s.y > h) s.y = 0
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [particles])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--color-bg)]">
      {/* 动态渐变光晕（呼吸） */}
      <div className="breathe absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[120px]" />
      <div
        className="breathe absolute top-1/3 -right-40 h-[36rem] w-[36rem] rounded-full bg-danger/10 blur-[120px]"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="breathe absolute bottom-0 left-1/3 h-[32rem] w-[32rem] rounded-full bg-[#7c5cff]/10 blur-[120px]"
        style={{ animationDelay: '4s' }}
      />
      {/* 星空粒子 */}
      {particles && <canvas ref={canvasRef} className="h-full w-full opacity-70" />}
      {/* 顶部暗角，保证文字可读 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-bg)]/40 via-transparent to-[var(--color-bg)]" />
    </div>
  )
}
