import { Github, Zap } from 'lucide-react'
import { StatusDot } from '@/components/ui/StatusDot'

interface FooterProps {
  version?: string
  apiOnline?: boolean
}

/** Footer — 极简居中，含 GitHub / API 状态 / 版本 / 部署来源 */
export function Footer({ version = '2.0.0', apiOnline = true }: FooterProps) {
  return (
    <footer className="mt-32 flex flex-col items-center gap-4 pb-12 text-center">
      <div className="flex items-center gap-5 text-caption text-secondary">
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
          <StatusDot state={apiOnline ? 'online' : 'offline'} />
          API {apiOnline ? '在线' : '离线'}
        </span>
        <span>v{version}</span>
      </div>
      <div className="inline-flex items-center gap-1.5 text-xs text-tertiary">
        <Zap size={12} className="text-[var(--color-primary)]" />
        Powered by GitHub Actions
      </div>
    </footer>
  )
}
