import { motion } from 'framer-motion'
import { Radio, Tv, Video, MessageCircle, Swords, Sparkles, type LucideIcon } from 'lucide-react'
import { EASE_OUT } from '@/constants'
import { timeAgo } from '@/utils/time'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'

interface HeroProps {
  live: boolean
  liveTitle?: string
  lastUpdate?: string
  particles: boolean
  onToggleParticles: () => void
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: EASE_OUT },
  },
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

interface QuickEntry {
  icon: LucideIcon
  label: string
  onClick: () => void
  muted: boolean
}

const QUICK_ENTRIES: QuickEntry[] = [
  { icon: Tv, label: '直播', onClick: () => scrollToId('status'), muted: false },
  { icon: Video, label: '视频', onClick: () => {}, muted: true },
  { icon: MessageCircle, label: '微博', onClick: () => {}, muted: true },
  { icon: Swords, label: '战绩', onClick: () => scrollToId('stats'), muted: false },
]

export function Hero({
  live,
  liveTitle,
  lastUpdate,
  particles,
  onToggleParticles,
}: HeroProps) {
  const entries = QUICK_ENTRIES

  return (
    <header className="relative flex min-h-[82vh] flex-col items-center justify-center px-6 text-center">
      <Button
        active={particles}
        onClick={onToggleParticles}
        className="absolute right-0 top-2"
        aria-label="切换星空粒子"
      >
        <Sparkles size={14} />
        粒子
      </Button>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex max-w-3xl flex-col items-center"
      >
        <motion.div
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-white/5 px-3 py-1.5 text-caption text-secondary"
        >
          <StatusDot state={live ? 'live' : 'online'} />
          REALTIME DASHBOARD
        </motion.div>

        <motion.h1
          variants={item}
          className="text-display font-bold tracking-tight text-balance"
        >
          TheShy Monitor
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-5 max-w-xl text-h3 font-normal text-secondary text-balance"
        >
          实时监控 TheShy 的所有动态
        </motion.p>

        <motion.div
          variants={item}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-caption text-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <StatusDot state={live ? 'live' : 'offline'} />
            {live ? '直播中' : '未直播'}
          </span>
          <span className="text-tertiary">·</span>
          <span>最后更新 {lastUpdate ? timeAgo(lastUpdate) : '—'}</span>
          <span className="text-tertiary">·</span>
          <span>刷新频率 30s</span>
        </motion.div>

        {live && liveTitle && (
          <motion.div
            variants={item}
            className="mt-4 inline-flex items-center gap-2 rounded-sm bg-[var(--color-danger-soft)] px-3 py-1.5 text-caption text-[var(--color-danger)]"
          >
            <Radio size={14} />
            {liveTitle}
          </motion.div>
        )}

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {entries.map((e) => (
            <button
              key={e.label}
              type="button"
              onClick={e.onClick}
              disabled={e.muted}
              className={`inline-flex items-center gap-2 rounded-sm border px-4 py-2.5 text-caption font-medium transition-colors duration-200 ${
                e.muted
                  ? 'cursor-not-allowed border-[var(--color-border)] text-tertiary'
                  : 'border-[var(--color-border-strong)] text-text hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]'
              }`}
            >
              <e.icon size={15} />
              {e.label}
            </button>
          ))}
        </motion.div>
      </motion.div>
    </header>
  )
}
