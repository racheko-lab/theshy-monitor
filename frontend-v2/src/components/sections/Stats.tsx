import { lazy, Suspense, useMemo, type ReactNode } from 'react'
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
import { useInView } from '@/hooks/useInView'

// ECharts 拆为独立 chunk（代码分割）；图表组件通过 IntersectionObserver 在进入视口时才挂载，
// 实现真正按需加载 —— 首屏不下载 339KB gzip 的 ECharts，滚动到「数据统计」才请求。
const MatchesChart = lazy(() => import('./charts/MatchesChart'))
const LpChart = lazy(() => import('./charts/LpChart'))
const WinRateChart = lazy(() => import('./charts/WinRateChart'))

function ChartFallback() {
  return <Skeleton className="h-[220px] w-full" />
}

/** 进入视口才挂载图表（真正懒加载）；未进入视口时仅显示骨架 */
function ChartBlock({ title, subtitle, className, children }: {
  title: string
  subtitle: string
  className?: string
  children: ReactNode
}) {
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={className}>
      <ChartCard title={title} subtitle={subtitle}>
        {inView ? children : <ChartFallback />}
      </ChartCard>
    </div>
  )
}

export function Stats({ data, events, slug = 'main' }: { data: AppData; events: AppEvent[]; slug?: string }) {
  const stats = useMemo(() => computeStats(data, slug), [data, slug])
  const dailyMatches = useMemo(() => aggregateDailyMatches(events, 30), [events])
  const dailyLp = useMemo(() => aggregateDailyLp(events, 30), [events])
  const matches = getAccount(data, slug).matches

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
        <ChartBlock title="每日对局" subtitle="近 30 天">
          <Suspense fallback={<ChartFallback />}>
            <MatchesChart data={dailyMatches} />
          </Suspense>
        </ChartBlock>
        <ChartBlock title="每日 LP 变化" subtitle="近 30 天净增减">
          <Suspense fallback={<ChartFallback />}>
            <LpChart data={dailyLp} />
          </Suspense>
        </ChartBlock>
        <ChartBlock title="累计胜率走势" subtitle="按对局时间" className="lg:col-span-2">
          <Suspense fallback={<ChartFallback />}>
            <WinRateChart matches={matches} />
          </Suspense>
        </ChartBlock>
      </div>
    </section>
  )
}
