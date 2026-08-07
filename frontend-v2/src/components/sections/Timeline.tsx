import { motion } from 'framer-motion'
import {
  Swords,
  TrendingUp,
  ArrowUp,
  Flame,
  Medal,
  Play,
  Tv,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { AppEvent } from '@/types'
import { itemVariants, containerVariants } from '@/constants'
import { buildTimeline, type TimelineItem } from '@/utils/data'
import { clock, DAY_GROUP_LABEL } from '@/utils/time'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Tag } from '@/components/ui/Tag'

const META: Record<AppEvent['type'], { icon: LucideIcon; color: string }> = {
  new_match: { icon: Swords, color: 'var(--color-primary)' },
  lp_changed: { icon: TrendingUp, color: 'var(--color-success)' },
  level_changed: { icon: ArrowUp, color: 'var(--color-warning)' },
  losing_streak: { icon: Flame, color: 'var(--color-danger)' },
  winning_streak: { icon: Flame, color: 'var(--color-success)' },
  rank_changed: { icon: Medal, color: 'var(--color-primary)' },
  became_active: { icon: Play, color: 'var(--color-primary)' },
  bilibili_live: { icon: Tv, color: 'var(--color-danger)' },
  hupu_rating: { icon: Trophy, color: 'var(--color-warning)' },
  opgg_updated: { icon: Swords, color: 'var(--color-text-tertiary)' },
}

const GROUP_ORDER: TimelineItem['group'][] = ['today', 'yesterday', 'earlier']

export function Timeline({ events }: { events: AppEvent[] }) {
  const items = buildTimeline(events)
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: items.filter((it) => it.group === g),
  })).filter((g) => g.items.length > 0)

  return (
    <section id="timeline" className="mx-auto max-w-3xl px-6 py-16">
      <SectionTitle eyebrow="Timeline" title="动态时间轴" />
      <div className="flex flex-col gap-10">
        {grouped.map((group) => (
          <div key={group.group}>
            <div className="mb-5 text-caption font-medium uppercase tracking-[0.18em] text-secondary">
              {DAY_GROUP_LABEL[group.group]}
            </div>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-8% 0px' }}
              className="relative pl-6"
            >
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--color-border-strong)]" />
              <div className="flex flex-col gap-5">
                {group.items.map((it) => {
                  const meta = META[it.type]
                  const Icon = meta.icon
                  const smurf = it.slug === 'smurf'
                  return (
                    <motion.div key={it.key} variants={itemVariants} className="relative" data-timeline-item>
                      <span
                        className="absolute -left-6 top-1.5 h-3 w-3 rounded-full border-2"
                        style={{ borderColor: meta.color, backgroundColor: 'var(--color-bg)' }}
                      />
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: meta.color }}
                        >
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-body font-medium text-text">{it.title}</span>
                            {smurf && <Tag>小号</Tag>}
                          </div>
                          {it.subtitle && (
                            <div className="mt-0.5 truncate text-caption text-secondary">
                              {it.subtitle}
                            </div>
                          )}
                        </div>
                        <time className="ml-2 shrink-0 text-xs tabular-nums text-tertiary">
                          {clock(it.timestamp)}
                        </time>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="text-caption text-tertiary">暂无动态</div>
        )}
      </div>
    </section>
  )
}
