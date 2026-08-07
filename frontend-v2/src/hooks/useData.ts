import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData, AppEvent } from '@/types'
import { INLINE_DATA_KEY, REFRESH_INTERVAL } from '@/constants'

// ============================================================
// useData — 数据加载 + 状态机
// 1) 首屏使用 build.py 注入的 window.__INITIAL_DATA__（秒开）
// 2) 之后每 30s 轮询 ./data.json + ./events.json（相对路径，兼容 /v2/ 子路径）
// 3) 完整错误态：HTTP 失败 / JSON 解析失败 / 网络断开 / 超时
//    失败时不静默吞掉，而是暴露 error + stale（缓存）标记，并提供 retry
// 4) 基于「最近一次成功 fetch 时间」派生 apiStatus（online/delayed/offline）
// 不修改任何数据接口，仅消费现有 JSON。
// ============================================================

interface InlineData {
  data: AppData
  events: AppEvent[]
}

export type ApiStatus = 'online' | 'delayed' | 'offline'

/** 单次请求超时（毫秒）——网络无响应时给出明确失败而非永久转圈 */
const FETCH_TIMEOUT = 15_000

/** online < 30s；delayed 30~120s；offline > 2min */
const DELAYED_AFTER = 30_000
const OFFLINE_AFTER = 120_000

export interface UseDataResult {
  data?: AppData
  events: AppEvent[]
  /** 首屏加载中（尚无任何数据） */
  loading: boolean
  /** 周期刷新进行中 */
  refreshing: boolean
  hasInline: boolean
  /** 最近一次 fetch 的错误描述（网络/解析/HTTP/超时），无错误为 null */
  error: string | null
  /** 当前展示的是失败前的缓存数据 */
  stale: boolean
  /** 重新发起一次 fetch */
  retry: () => void
  /** 最近一次成功 fetch 的时间戳（Date.now()），从未成功为 null */
  lastSuccess: number | null
  /** 后端数据生成时间（data.last_update） */
  lastUpdated: string | null
  /** 由 lastSuccess 推导的真实连接状态 */
  apiStatus: ApiStatus
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'AbortError' || /timeout|abort|time out/i.test(err.message)
}

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (isTimeoutError(err)) return '请求超时，网络可能已断开'
    if (/Failed to fetch|NetworkError|Network request failed/i.test(err.message)) {
      return '网络已断开，无法连接到数据源'
    }
    return err.message
  }
  return '数据加载失败'
}

export function useData(): UseDataResult {
  const inline = (globalThis as unknown as Record<string, InlineData>)[INLINE_DATA_KEY]
  const [data, setData] = useState<AppData | undefined>(inline?.data)
  const [events, setEvents] = useState<AppEvent[]>(inline?.events ?? [])
  const [loading, setLoading] = useState(!inline)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [lastSuccess, setLastSuccess] = useState<number | null>(inline ? Date.now() : null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(inline?.data.last_update ?? null)

  // apiStatus 仅在 30s(delayed) / 120s(offline) 阈值附近翻转，无需 1s 粒度。
  // 用 10s tick 即可正确降级，避免 App 整树每秒重渲染。
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(id)
  }, [])

  const dataRef = useRef<AppData | undefined>(inline?.data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const poll = useCallback(async () => {
    setRefreshing(true)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    try {
      const [dRes, eRes] = await Promise.all([
        fetch(`./data.json?t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' }),
        fetch(`./events.json?t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' }),
      ])
      clearTimeout(timer)
      if (!dRes.ok || !eRes.ok) {
        const bad = !dRes.ok ? 'data.json' : 'events.json'
        throw new Error(`${bad} 请求失败（HTTP ${!dRes.ok ? dRes.status : eRes.status}）`)
      }
      let d: AppData
      let e: AppEvent[]
      try {
        d = (await dRes.json()) as AppData
        e = (await eRes.json()) as AppEvent[]
      } catch {
        throw new Error('数据解析失败：JSON 格式错误')
      }
      setData(d)
      setEvents(e)
      setLoading(false)
      setLastUpdated(d.last_update ?? null)
      setLastSuccess(Date.now())
      setError(null)
      setStale(false)
    } catch (err) {
      clearTimeout(timer)
      setError(describeError(err))
      if (dataRef.current) {
        // 已有缓存数据 → 保留展示并标记 stale
        setStale(true)
      } else {
        // 首屏即失败 → 结束 loading，交由全局 Error 态接管（避免永久转圈）
        setLoading(false)
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  const pollRef = useRef(poll)
  pollRef.current = poll

  const retry = useCallback(() => {
    setError(null)
    setStale(false)
    void pollRef.current()
  }, [])

  useEffect(() => {
    void poll()
    const id = window.setInterval(() => void pollRef.current(), REFRESH_INTERVAL)
    return () => window.clearInterval(id)
  }, [poll])

  const apiStatus: ApiStatus = !lastSuccess
    ? 'offline'
    : now - lastSuccess < DELAYED_AFTER
      ? 'online'
      : now - lastSuccess < OFFLINE_AFTER
        ? 'delayed'
        : 'offline'

  return {
    data,
    events,
    loading,
    refreshing,
    hasInline: Boolean(inline),
    error,
    stale,
    retry,
    lastSuccess,
    lastUpdated,
    apiStatus,
  }
}
