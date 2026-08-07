// ============================================================
// 时间工具 — 统一格式化与日期分组
// 数据时间为 KST(+09:00)，直接按 ISO 解析即可正确显示本地时区。
// ============================================================

const MINUTE = 60
const HOUR = 3600
const DAY = 86_400

/** 相对时间：14秒前 / 3分钟前 / 2小时前 / 3天前 */
export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diff < 60) return `${diff}秒前`
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}小时前`
  if (diff < DAY * 30) return `${Math.floor(diff / DAY)}天前`
  return `${Math.floor(diff / (DAY * 30))}个月前`
}

/** 时钟：HH:MM */
export function clock(iso?: string): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** 日期短标：M月D日 */
export function dateShort(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 时长：秒 → 31m / 1h05m */
export function duration(sec?: number): string {
  if (!sec || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`
  return `${m}m`
}

/** 今天 / 昨天 / 更早 —— 时间轴分组标签 */
export function dayGroup(iso?: string): 'today' | 'yesterday' | 'earlier' {
  if (!iso) return 'earlier'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'earlier'
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - DAY * 1000
  const t = d.getTime()
  if (t >= startOfToday) return 'today'
  if (t >= startOfYesterday) return 'yesterday'
  return 'earlier'
}

export const DAY_GROUP_LABEL: Record<'today' | 'yesterday' | 'earlier', string> = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
}

/** 取 YYYY-MM-DD（本地）用于热力图聚合 */
export function dayKey(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 月份键 YYYY-MM */
export function monthKey(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
