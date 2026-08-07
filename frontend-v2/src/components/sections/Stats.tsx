import { lazy, Suspense, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Swords, Trophy, Percent, Gauge, Timer, Clock } from 'lucide-react'
import type { AppData, AppEvent } from '@/types'
import { containerVariants, itemVariants } from '@/constants'
import {
  computeStats,
  aggregateDailyMatches,
  aggregateDailyLp,
  getAccount,
} from '@/utils/data'
import { duration } from '@/utils/time'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { StatCard } from '@/components/ui/StatCard'
import { ChartCard } from '@/components/ui/ChartCard'
import { Skeleton } from '@/components/ui/Skeleton'

// 图表按需加载（ECharts 独立 chunk，进入视口才加载）
const MatchesChart = lazy(() => import('./charts/MatchesChart'))
const LpChart = lazy(() => import('./charts/LpChart'))
const WinRateChart = lazy(() => import('./charts/WinRateChart'))

function ChartFallback() {
  return <Skeleton className="h-[220px] w-full" />
}

export function Stats({ data, events }: { data: AppData; events: AppEvent[] }) {
  const stats = useMemo(() => computeStats(data, events), [data, events])
  const dailyMatches = useMemo(() => aggregateDailyMatches(events, 30), [events])
  const dailyLp = useMemo(() => aggregateDailyLp(events, 30), [events])
  const matches = getAccount(data, 'main').matches

  const cards = useMemo(
    () => [
    { label: '总对局', value: stats.totalMatches, icon: Swords },
    { label: '胜场', value: stats.totalWins, icon: Trophy, tone: 'success' as const },
    { label: '胜率', value: stats.winRate, suffix: '%', icon: Percent, tone: 'primary' as const },
    { label: '当前 LP', value: stats.currentLp, icon: Gauge, tone: 'primary' as const },
    { label: '场均时长', value: 0, icon: Timer, custom: duration(stats.avgGameLength), tone: 'default' as const },
    { label: '最长对局', value: 0, icon: Clock, custom: duration(stats.longestGame), tone: 'default' as const },
    ],
    [stats],
  )

  return (
    <section id="stats" className="mx-auto max-w-6xl px-6 py-16">
      <SectionTitle eyebrow="Analytics" title="数据统计" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-10% 0px' }}
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
      >
        {cards.map((c) =>
          c.custom ? (
            <motion.div key={c.label} variants={itemVariants}>
              <StatCard label={c.label} value={0} icon={c.icon}>
                <span className="text-h2 font-semibold">{c.custom}</span>
              </StatCard>
            </motion.div>
          ) : (
            <motion.div key={c.label} variants={itemVariants}>
              <StatCard
                label={c.label}
                value={c.value}
                suffix={c.suffix}
                icon={c.icon}
                tone={c.tone}
              />
            </motion.div>
          ),
        )}
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="每日对局" subtitle="近 30 天">
          <Suspense fallback={<ChartFallback />}>
            <MatchesChart data={dailyMatches} />
          </Suspense>
        </ChartCard>
        <ChartCard title="每日 LP 变化" subtitle="近 30 天净增减">
          <Suspense fallback={<ChartFallback />}>
            <LpChart data={dailyLp} />
          </Suspense>
        </ChartCard>
        <ChartCard title="累计胜率走势" subtitle="按对局时间" className="lg:col-span-2">
          <Suspense fallback={<ChartFallback />}>
            <WinRateChart matches={matches} />
          </Suspense>
        </ChartCard>
      </div>
    </section>
  )
}
