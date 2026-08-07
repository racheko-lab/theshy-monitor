import { useState } from 'react'
import { useData } from '@/hooks/useData'
import { useLenis } from '@/hooks/useLenis'
import { Background } from '@/components/layout/Background'
import { LoadingBar } from '@/components/layout/LoadingBar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { StatusCards } from '@/components/sections/StatusCards'
import { Timeline } from '@/components/sections/Timeline'
import { Stats } from '@/components/sections/Stats'
import { Heatmap } from '@/components/sections/Heatmap'
import { Skeleton } from '@/components/ui/Skeleton'

function LoadingState() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-32">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-primary)]" />
        <p className="text-caption text-secondary">正在加载 TheShy 数据…</p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const { data, events, loading, refreshing, hasInline } = useData()
  useLenis()
  const [particles, setParticles] = useState(true)

  return (
    <>
      <Background particles={particles} />
      <LoadingBar active={refreshing || loading} />
      <main className="relative mx-auto w-full">
        {data ? (
          <>
            <Hero
              live={data.bilibili.is_live}
              liveTitle={data.bilibili.title}
              lastUpdate={data.last_update}
              particles={particles}
              onToggleParticles={() => setParticles((p) => !p)}
            />
            <StatusCards data={data} events={events} />
            <Timeline events={events} />
            <Stats data={data} events={events} />
            <Heatmap events={events} />
          </>
        ) : (
          <LoadingState />
        )}
        <Footer version="2.0.0" apiOnline={!loading || hasInline} />
      </main>
    </>
  )
}
