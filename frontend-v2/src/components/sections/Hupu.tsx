import { motion } from 'framer-motion'
import { CalendarClock, Trophy, Swords } from 'lucide-react'
import type { AppData, HupuMatch } from '@/types'
import { containerVariants, itemVariants } from '@/constants'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { SectionTitle } from '@/components/ui/SectionTitle'

function matchScore(m: HupuMatch): string {
  if (m.score && m.score !== '-') return m.score
  if (typeof m.home_score === 'number' && typeof m.away_score === 'number') {
    return `${m.home_score}-${m.away_score}`
  }
  return '—'
}

export function Hupu({ data }: { data: AppData }) {
  const h = data.hupu_ratings
  const has = !!(h && (h.team || (h.matches && h.matches.length) || h.next_match))
  if (!has) return null

  const next = h.next_match
  const latest = h.latest_match

  return (
    <section id="hupu" className="mx-auto max-w-6xl px-6 py-16">
      <SectionTitle eyebrow="Hupu" title="赛事评分" />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-10% 0px' }}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {/* 下一场比赛 */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <GlassCard className="flex h-full flex-col p-6">
            <div className="mb-4 flex items-center gap-2 text-caption text-secondary">
              <CalendarClock size={15} />
              下一场比赛
            </div>
            {next ? (
              <div className="flex flex-1 flex-col justify-center">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex flex-1 flex-col items-center gap-2">
                    {next.home_logo && (
                      <img src={next.home_logo} alt={next.home} className="h-12 w-12 object-contain" />
                    )}
                    <span className="text-body font-medium">{next.home}</span>
                  </div>
                  <span className="text-h3 font-semibold text-tertiary">VS</span>
                  <div className="flex flex-1 flex-col items-center gap-2">
                    {next.away_logo && (
                      <img src={next.away_logo} alt={next.away} className="h-12 w-12 object-contain" />
                    )}
                    <span className="text-body font-medium">{next.away}</span>
                  </div>
                </div>
                <div className="mt-4 text-center text-caption text-secondary">
                  {next.date_str} {next.time_str}
                  {next.stage && <span className="ml-2 text-tertiary">{next.stage}</span>}
                </div>
                {next.status_desc && (
                  <div className="mt-2 text-center">
                    <Badge tone="warning">{next.status_desc}</Badge>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-caption text-tertiary">
                暂无赛程
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* 最近一场 + 队伍 */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4">
          <GlassCard className="flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2 text-caption text-secondary">
              <Swords size={15} />
              最近一场
            </div>
            {latest ? (
              <>
                <div className="text-body font-medium">{latest.title}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-h2 font-semibold tabular-nums">{matchScore(latest)}</span>
                  {typeof latest.ig_win === 'boolean' && (
                    <Badge tone={latest.ig_win ? 'success' : 'danger'}>
                      {latest.ig_win ? '胜' : '负'}
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div className="text-caption text-tertiary">暂无</div>
            )}
          </GlassCard>

          <GlassCard className="flex flex-col p-6">
            <div className="mb-3 flex items-center gap-2 text-caption text-secondary">
              <Trophy size={15} />
              队伍
            </div>
            <div className="text-h2 font-semibold">{h.team || '—'}</div>
            {h.matches && h.matches.length > 0 && (
              <div className="mt-1 text-xs text-tertiary">近 {h.matches.length} 场赛事评分已记录</div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </section>
  )
}
