import { useEffect, useState } from 'react'
import type { AppData, AppEvent } from '@/types'
import { INLINE_DATA_KEY, REFRESH_INTERVAL } from '@/constants'

// ============================================================
// useData — 数据加载
// 1) 首屏使用 build.py 注入的 window.__INITIAL_DATA__（秒开）
// 2) 之后每 30s 轮询 ./data.json + ./events.json（相对路径，兼容 /v2/ 子路径）
// 不修改任何数据接口，仅消费现有 JSON。
// ============================================================

interface InlineData {
  data: AppData
  events: AppEvent[]
}

export interface UseDataResult {
  data?: AppData
  events: AppEvent[]
  loading: boolean
  refreshing: boolean
  hasInline: boolean
}

export function useData(): UseDataResult {
  const inline = (globalThis as unknown as Record<string, InlineData>)[INLINE_DATA_KEY]
  const [data, setData] = useState<AppData | undefined>(inline?.data)
  const [events, setEvents] = useState<AppEvent[]>(inline?.events ?? [])
  const [loading, setLoading] = useState(!inline)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let mounted = true

    async function poll() {
      if (mounted) setRefreshing(true)
      try {
        const [dRes, eRes] = await Promise.all([
          fetch(`./data.json?t=${Date.now()}`),
          fetch(`./events.json?t=${Date.now()}`),
        ])
        if (!dRes.ok || !eRes.ok) return
        const d: AppData = await dRes.json()
        const e: AppEvent[] = await eRes.json()
        if (mounted) {
          setData(d)
          setEvents(e)
          setLoading(false)
        }
      } catch {
        // 网络/路径异常时保留内联/已有数据，不阻塞渲染
      } finally {
        if (mounted) setRefreshing(false)
      }
    }

    poll()
    const id = window.setInterval(poll, REFRESH_INTERVAL)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  return { data, events, loading, refreshing, hasInline: Boolean(inline) }
}
