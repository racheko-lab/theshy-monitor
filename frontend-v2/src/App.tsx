import { useState } from 'react'
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react'
import { useData } from '@/hooks/useData'
import { useLenis } from '@/hooks/useLenis'
import { getAccount } from '@/utils/data'
import { Background } from '@/components/layout/Background'
import { LoadingBar } from '@/components/layout/LoadingBar'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { StatusCards } from '@/components/sections/StatusCards'
import { Timeline } from '@/components/sections/Timeline'
import { Stats } from '@/components/sections/Stats'
import { Heatmap } from '@/components/sections/Heatmap'
import { Hupu } from '@/components/sections/Hupu'
import { Skeleton } from '@/components/ui/Skeleton'
import { timeAgo } from '@/utils/time'

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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-40 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger-soft)] text-[var(--color-danger)]">
        <AlertTriangle size={26} />
      </div>
      <div>
        <h2 className="text-h3 text-text">数据加载失败</h2>
        <p className="mt-2 text-caption text-secondary">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-sm border border-[var(--color-border-strong)] px-4 py-2.5 text-caption font-medium text-text transition-colors duration-200 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]"
      >
        <RefreshCw size={15} />
        重试
      </button>
      <p className="text-xs text-tertiary">数据源：data.json · events.json</p>
    </div>
  )
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-40 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-tertiary">
        <Inbox size={26} />
      </div>
      <div>
        <h2 className="text-h3 text-text">暂无账号数据</h2>
        <p className="mt-2 text-caption text-secondary">尚未监测到任何账号，请稍后重试或检查配置。</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-sm border border-[var(--color-border-strong)] px-4 py-2.5 text-caption font-medium text-text transition-colors duration-200 hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]"
      >
        <RefreshCw size={15} />
        重试
      </button>
    </div>
  )
}

function StaleBanner({ message, lastUpdated, onRetry }: {
  message: string
  lastUpdated?: string | null
  onRetry: () => void
}) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 px-6 py-2.5 text-caption text-[var(--color-warning)] backdrop-blur">
      <AlertTriangle size={14} />
      <span>{message}</span>
      {lastUpdated && <span className="text-tertiary">· 缓存于 {timeAgo(lastUpdated)}</span>}
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[var(--color-warning)] underline-offset-2 hover:underline"
      >
        <RefreshCw size={12} />
        重试
      </button>
    </div>
  )
}

export default function App() {
  const { data, events, loading, refreshing, error, stale, retry, lastUpdated, apiStatus } = useData()
  useLenis()
  const [particles, setParticles] = useState(true)
  const [activeSlug, setActiveSlug] = useState('main')

  const showDashboard = Boolean(data && data.accounts.length > 0)
  const showError = Boolean(error && !data)
  const showEmpty = Boolean(data && data.accounts.length === 0)
  const activeAccount = data ? getAccount(data, activeSlug) : undefined

  return (
    <>
      <Background particles={particles} />
      <LoadingBar active={refreshing || loading} />
      <main className="relative mx-auto w-full">
        {showDashboard ? (
          <>
            {stale && error && (
              <StaleBanner message={error} lastUpdated={lastUpdated} onRetry={retry} />
            )}
            <Hero
              live={data!.bilibili.is_live}
              liveTime={data!.bilibili.live_time}
              liveTitle={data!.bilibili.title}
              lastUpdate={data!.last_update}
              particles={particles}
              onToggleParticles={() => setParticles((p) => !p)}
              account={activeAccount}
            />
            <StatusCards
              data={data!}
              events={events}
              slug={activeSlug}
              onSlugChange={setActiveSlug}
            />
            <Timeline events={events} slug={activeSlug} />
            <Stats data={data!} events={events} slug={activeSlug} />
            <Hupu data={data!} />
            <Heatmap events={events} />
          </>
        ) : showError ? (
          <ErrorState message={error!} onRetry={retry} />
        ) : showEmpty ? (
          <EmptyState onRetry={retry} />
        ) : (
          <LoadingState />
        )}
        <Footer
          version="2.0.0"
          apiStatus={apiStatus}
          lastUpdated={lastUpdated}
          stale={stale}
          onRetry={retry}
        />
      </main>
    </>
  )
}
