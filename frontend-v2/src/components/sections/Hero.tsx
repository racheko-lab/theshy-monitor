import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Radio, Tv, Swords, Sparkles, type LucideIcon } from 'lucide-react'
import { EASE_OUT } from '@/constants'
import { timeAgo, clock, dateShort, duration } from '@/utils/time'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'
import type { Account } from '@/types'

interface HeroProps {
  live: boolean
  liveTime?: string
  liveTitle?: string
  lastUpdate?: string
  particles: boolean
  onToggleParticles: () => void
  /** 当前选中的账号（跟随账号切换） */
  account?: Account
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

/** 直播已播时长 —— 独立 1s 定时器，仅此文本每秒重渲染，Hero 主树不再每秒重渲染 */
function LiveDuration({ liveTime }: { liveTime: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.floor((now - new Date(liveTime).getTime()) / 1000))
  return <span>已播 {duration(seconds)}</span>
}

export function Hero({
  live,
  liveTime,
  liveTitle,
  lastUpdate,
  particles,
  onToggleParticles,
  account,
}: HeroProps) {
  const liveStartValid = !!liveTime && liveTime !== '0000-00-00 00:00:00'

  const entries: { icon: LucideIcon; label: string; onClick: () => void }[] = [
    { icon: Tv, label: '直播', onClick: () => scrollToId('status') },
    { icon: Swords, label: '战绩', onClick: () => scrollToId('stats') },
  ]

  return (
    <header className="relative flex min-h-[82dvh] flex-col items-center justify-center px-6 text-center">
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
          {account && (
            <span className="ml-1 inline-flex items-center gap-1.5 border-l border-[var(--color-border-strong)] pl-2">
              {account.profile.profile_image_url ? (
                <img
                  src={account.profile.profile_image_url}
                  alt={account.game_name}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : null}
              {account.label}
            </span>
          )}
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
          {live && liveStartValid && (
            <>
              <span className="text-tertiary">·</span>
              <span>开播 {dateShort(liveTime)} {clock(liveTime)}</span>
              <span className="text-tertiary">·</span>
              <LiveDuration liveTime={liveTime!} />
            </>
          )}
          {!live && liveStartValid && (
            <>
              <span className="text-tertiary">·</span>
              <span>距上次直播 {timeAgo(liveTime)}</span>
            </>
          )}
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
              className="inline-flex items-center gap-2 rounded-sm border border-[var(--color-border-strong)] px-4 py-2.5 text-caption font-medium text-secondary transition-colors duration-200 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)] hover:text-text"
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
