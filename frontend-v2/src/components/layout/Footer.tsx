import { Github, Zap, RefreshCw } from 'lucide-react'
import { StatusDot } from '@/components/ui/StatusDot'
import { timeAgo } from '@/utils/time'
import type { ApiStatus } from '@/hooks/useData'

interface FooterProps {
  version?: string
  apiStatus: ApiStatus
  lastUpdated?: string | null
  stale?: boolean
  onRetry?: () => void
}

const STATUS_LABEL: Record<ApiStatus, string> = {
  online: '在线',
  delayed: '延迟',
  offline: '离线',
}

/** Footer — 极简居中，含 GitHub / 真实 API 状态 / 版本 / 部署来源 */
export function Footer({
  version = '2.0.0',
  apiStatus,
  lastUpdated,
  stale,
  onRetry,
}: FooterProps) {
  return (
    <footer className="mt-32 flex flex-col items-center gap-4 pb-[max(3rem,env(safe-area-inset-bottom))] text-center">
      <div className="flex flex-wrap items-center justify-center gap-5 px-6 text-caption text-secondary">
        <a
          href="https://github.com/racheko-lab/theshy-monitor"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors duration-200 hover:text-text"
        >
          <Github size={15} />
          GitHub
        </a>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot state={apiStatus} />
          API {STATUS_LABEL[apiStatus]}
          {stale && <span className="text-[var(--color-warning)]">· 缓存</span>}
        </span>
        {lastUpdated && (
          <span className="text-tertiary">更新 {timeAgo(lastUpdated)}</span>
        )}
        {stale && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-[var(--color-warning)] transition-colors duration-200 hover:text-text"
          >
            <RefreshCw size={13} />
            重试
          </button>
        )}
        <span>v{version}</span>
      </div>
      <div className="inline-flex items-center gap-1.5 text-xs text-tertiary">
        <Zap size={12} className="text-[var(--color-primary)]" />
        Powered by GitHub Actions
      </div>
    </footer>
  )
}
