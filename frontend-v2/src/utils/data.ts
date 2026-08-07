import type { AppData, AppEvent, Account, LeagueStat, Match, LpChangedEvent } from '@/types'
import { dayGroup, dayKey, monthKey, duration } from './time'
import { tierLabelCn } from '@/constants'

// ============================================================
// 数据工具 — 事件过滤 / 时间轴归一化 / 图表聚合 / 统计计算
// 全部纯函数，输入真实数据，输出 UI 友好结构。
// ============================================================

export interface TimelineItem {
  key: string
  type: AppEvent['type']
  timestamp: string
  group: 'today' | 'yesterday' | 'earlier'
  slug?: string
  account?: string
  title: string
  subtitle?: string
  raw: AppEvent
}

/** 时间轴只展示有意义的事件，过滤掉高频轮询噪声 opgg_updated */
export function buildTimeline(events: AppEvent[]): TimelineItem[] {
  const items: TimelineItem[] = []
  let i = 0
  for (const e of events) {
    if (e.type === 'opgg_updated') continue
    const ts = e.timestamp
    items.push({
      key: `${e.type}-${ts}-${i++}`,
      type: e.type,
      timestamp: ts,
      group: dayGroup(ts),
      slug: 'slug' in e ? e.slug : undefined,
      account: 'account' in e ? e.account : undefined,
      title: eventTitle(e),
      subtitle: eventSubtitle(e),
      raw: e,
    })
  }
  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

/** 类型守卫：收窄 lp_changed 事件（含 slug / delta） */
export function isLpChanged(e: AppEvent): e is LpChangedEvent {
  return e.type === 'lp_changed'
}

function eventTitle(e: AppEvent): string {
  switch (e.type) {
    case 'new_match':
      return `${e.champion} ${e.result === 'WIN' ? '胜利' : '失败'}`
    case 'lp_changed':
      return `LP ${e.delta >= 0 ? '+' : ''}${e.delta}`
    case 'level_changed':
      return `等级提升至 ${e.new}`
    case 'losing_streak':
      return `${e.streak} 连败`
    case 'winning_streak':
      return `${e.streak} 连胜`
    case 'rank_changed':
      return '段位变化'
    case 'became_active':
      return '进入对局'
    case 'bilibili_live':
      return (e.kind ?? '').includes('start') ? '直播开始' : '直播结束'
    case 'hupu_rating':
      return '赛事评分更新'
    default:
      return '动态'
  }
}

function eventSubtitle(e: AppEvent): string {
  switch (e.type) {
    case 'new_match':
      return `KDA ${e.kda} · ${duration(e.game_length_second)} · ${e.account}`
    case 'lp_changed':
      return `${tierLabelCn(e.tier)} · ${e.account}`
    case 'level_changed':
      return `${e.old} → ${e.new} · ${e.account}`
    case 'losing_streak':
    case 'winning_streak':
      return e.account
    case 'rank_changed':
      return `${e.old} → ${e.new}`
    case 'became_active':
      return e.account ?? ''
    case 'bilibili_live':
      return e.title
    case 'hupu_rating':
      return e.title
    default:
      return ''
  }
}

// ---- 图表聚合 ----

function lastNDays(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    out.push(dayKey(d.toISOString()))
  }
  return out
}

export interface SeriesPoint {
  date: string
  value: number
}

/** 每日对局数（近 N 天），用于柱状图 */
export function aggregateDailyMatches(events: AppEvent[], n = 30): SeriesPoint[] {
  const days = lastNDays(n)
  const set = new Set(days)
  const count: Record<string, number> = {}
  for (const e of events) {
    if (e.type !== 'new_match') continue
    const k = dayKey(e.timestamp)
    if (set.has(k)) count[k] = (count[k] || 0) + 1
  }
  return days.map((d) => ({ date: d, value: count[d] || 0 }))
}

/** 每日 LP 净变化（近 N 天），用于面积/折线图 */
export function aggregateDailyLp(events: AppEvent[], n = 30): SeriesPoint[] {
  const days = lastNDays(n)
  const set = new Set(days)
  const sum: Record<string, number> = {}
  for (const e of events) {
    if (e.type !== 'lp_changed') continue
    const k = dayKey(e.timestamp)
    if (set.has(k)) sum[k] = (sum[k] || 0) + (e.delta || 0)
  }
  return days.map((d) => ({ date: d, value: sum[d] || 0 }))
}

// ---- 月份热力图 ----

export interface HistoryMonth {
  key: string
  label: string
  total: number
  days: Record<string, number>
  items: TimelineItem[]
}

/** 近 N 个月活跃热力图（按有意义事件计数） */
export function buildHistory(events: AppEvent[], months = 6): HistoryMonth[] {
  const all = buildTimeline(events)
  const now = new Date()
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(monthKey(d.toISOString()))
  }
  const out: HistoryMonth[] = []
  for (const k of keys) {
    const items = all.filter((it) => monthKey(it.timestamp) === k)
    const days: Record<string, number> = {}
    let total = 0
    for (const it of items) {
      const dk = dayKey(it.timestamp)
      days[dk] = (days[dk] || 0) + 1
      total += 1
    }
    out.push({ key: k, label: `${new Date(k + '-01').getFullYear()}年${Number(k.split('-')[1])}月`, total, days, items })
  }
  return out
}

// ---- 统计计算 ----

export function getAccount(data: AppData, slug = 'main'): Account {
  return data.accounts.find((a) => a.slug === slug) ?? data.accounts[0]
}

export function getSoloranked(account: Account): LeagueStat | undefined {
  return account.profile.league_stats.find((l) => l.game_type === 'SOLORANKED')
}

export interface StatsSummary {
  totalMatches: number
  totalWins: number
  totalLosses: number
  winRate: number
  currentLp: number
  tier?: string
  division?: number
  ladderRank?: number
  ladderTotal?: number
  avgGameLength: number
  longestGame: number
  level: number
}

export function computeStats(data: AppData, slug = 'main'): StatsSummary {
  const main = getAccount(data, slug)
  const solo = getSoloranked(main)
  const totalMatches = solo?.play ?? main.matches.length
  const totalWins = solo?.win ?? 0
  const totalLosses = solo?.lose ?? 0
  const winRate = totalMatches ? Math.round((totalWins / totalMatches) * 100) : 0

  const lens = main.matches.map((m: Match) => m.game_length_second).filter(Boolean)
  const avgGameLength = lens.length
    ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)
    : 0
  const longestGame = lens.length ? Math.max(...lens) : 0

  // 注：近段时间 LP 净变化由 StatusCards 自行按 slug 计算并展示（见 StatusCards.buildStatusCards），
  // 此处 computeStats 不重复计算（避免硬编码 slug 的死值）。
  return {
    totalMatches,
    totalWins,
    totalLosses,
    winRate,
    currentLp: solo?.lp ?? 0,
    tier: solo?.tier,
    division: solo?.division,
    ladderRank: main.profile.ladder_rank?.rank,
    ladderTotal: main.profile.ladder_rank?.total,
    avgGameLength,
    longestGame,
    level: main.profile.level,
  }
}
