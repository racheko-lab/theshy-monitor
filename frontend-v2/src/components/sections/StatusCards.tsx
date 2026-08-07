import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Tv, Swords, TrendingUp, Medal, type LucideIcon } from 'lucide-react'
import type { AppData, AppEvent, Account, LpChangedEvent } from '@/types'
import { containerVariants, itemVariants, tierLabelCn } from '@/constants'
import { getAccount, getSoloranked, isLpChanged } from '@/utils/data'
import { timeAgo } from '@/utils/time'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { SectionTitle } from '@/components/ui/SectionTitle'

interface CardModel {
  key: string
  icon: LucideIcon
  label: string
  value: string
  sub: string
  badge?: { tone: 'primary' | 'success' | 'danger' | 'neutral'; text: string }
  accent: string
}

/** 账号切换器 —— 多账号（Main / Smurf）切换，所有统计跟随 */
function AccountSwitcher({
  accounts,
  active,
  onChange,
}: {
  accounts: Account[]
  active: string
  onChange: (slug: string) => void
}) {
  if (accounts.length <= 1) return null
  return (
    <div className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border-strong)] p-1">
      {accounts.map((a) => {
        const on = a.slug === active
        return (
          <button
            key={a.slug}
            type="button"
            onClick={() => onChange(a.slug)}
            className={`rounded-[5px] px-3 py-1.5 text-caption font-medium transition-colors duration-200 ${
              on
                ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'text-secondary hover:text-text'
            }`}
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

/** 由 data + slug + recentLpDelta 派生的状态卡列表（纯函数，便于 useMemo 仅依赖三者） */
function buildStatusCards(data: AppData, slug: string, recentLpDelta: number): CardModel[] {
  const main = getAccount(data, slug)
  const solo = getSoloranked(main)
  const bili = data.bilibili
  const winRate = solo ? Math.round((solo.win / Math.max(1, solo.play)) * 100) : 0
  const live = bili.is_live
  return [
    {
      key: 'live',
      icon: Tv,
      label: 'Live',
      value: live ? '直播中' : '未直播',
      sub: live
        ? bili.title || 'Bilibili 直播间'
        : `上次 ${bili.live_time && bili.live_time !== '0000-00-00 00:00:00' ? timeAgo(bili.live_time) : '—'}`,
      badge: live ? { tone: 'danger', text: 'LIVE' } : undefined,
      accent: 'var(--color-danger)',
    },
    {
      key: 'matches',
      icon: Swords,
      label: 'Matches',
      value: `${solo?.play ?? main.matches.length}`,
      sub: `胜率 ${winRate}% · ${solo?.win ?? 0}胜${solo?.lose ?? 0}负`,
      accent: 'var(--color-primary)',
    },
    {
      key: 'lp',
      icon: TrendingUp,
      label: 'LP',
      value: `${solo?.lp ?? 0}`,
      sub: `${tierLabelCn(solo?.tier)} · KR #${main.profile.ladder_rank?.rank ?? '—'}`,
      badge:
        recentLpDelta !== 0
          ? {
              tone: recentLpDelta > 0 ? 'success' : 'danger',
              text: `${recentLpDelta > 0 ? '+' : ''}${recentLpDelta} LP`,
            }
          : undefined,
      accent: 'var(--color-primary)',
    },
    {
      key: 'rank',
      icon: Medal,
      label: 'Rank',
      value: tierLabelCn(solo?.tier) || '—',
      sub: `KR #${main.profile.ladder_rank?.rank ?? '—'} · ${solo?.division ?? ''}段`,
      accent: 'var(--color-success)',
    },
  ]
}

export function StatusCards({
  data,
  events,
  slug = 'main',
  onSlugChange,
}: {
  data: AppData
  events: AppEvent[]
  slug?: string
  onSlugChange?: (slug: string) => void
}) {
  const recentLpDelta = useMemo(
    () =>
      events
        .filter((e): e is LpChangedEvent => isLpChanged(e) && e.slug === slug)
        .reduce((s, e) => s + e.delta, 0),
    [events, slug],
  )

  const cards = useMemo(
    () => buildStatusCards(data, slug, recentLpDelta),
    [data, slug, recentLpDelta],
  )

  return (
    <section id="status" className="mx-auto max-w-6xl px-6 py-16">
      <SectionTitle
        eyebrow="Status"
        title="实时状态"
        action={
          onSlugChange && (
            <AccountSwitcher
              accounts={data.accounts}
              active={slug}
              onChange={onSlugChange}
            />
          )
        }
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-10% 0px' }}
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {cards.map((c) => (
          <motion.div key={c.key} variants={itemVariants}>
            <GlassCard className="flex h-full flex-col p-6">
              <div className="flex items-start justify-between">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: c.accent }}
                >
                  <c.icon size={18} />
                </span>
                {c.badge && <Badge tone={c.badge.tone}>{c.badge.text}</Badge>}
              </div>
              <div className="mt-5 text-h2 font-semibold tabular-nums">{c.value}</div>
              <div className="mt-1 text-caption text-secondary">{c.label}</div>
              <div className="mt-3 text-xs text-tertiary">{c.sub}</div>
            </GlassCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  )
}
