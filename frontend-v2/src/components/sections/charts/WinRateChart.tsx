import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import type { Match } from '@/types'
import { axisCommon, tooltipCommon, baseGrid } from './theme'
import { useFirstAnimation } from '@/hooks/useFirstAnimation'

/** 累计胜率走势 — 折线（按对局时间累计，主色细线） */
export default function WinRateChart({ matches }: { matches: Match[] }) {
  const firstRef = useFirstAnimation()
  const points = useMemo(() => {
    const sorted = [...matches].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    let wins = 0
    return sorted.map((m, i) => {
      if (m.result === 'WIN') wins += 1
      return {
        date: m.created_at.slice(5, 10),
        rate: Math.round((wins / (i + 1)) * 100),
      }
    })
  }, [matches])

  const option = useMemo<EChartsOption>(() => {
    const base: EChartsOption = {
      grid: baseGrid,
      tooltip: { ...tooltipCommon, valueFormatter: (v) => `${v}%` },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.date),
        ...axisCommon,
        axisLabel: {
          ...axisCommon.axisLabel,
          interval: Math.max(0, Math.ceil(points.length / 6) - 1),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        ...axisCommon,
        splitLine: axisCommon.splitLine,
        axisLabel: { ...axisCommon.axisLabel, formatter: '{value}%' },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: points.map((p) => p.rate),
          lineStyle: { color: '#4F8CFF', width: 2 },
          itemStyle: { color: '#4F8CFF' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(79,140,255,0.22)' },
              { offset: 1, color: 'rgba(79,140,255,0)' },
            ]),
          },
        },
      ],
    }
    return firstRef.current
      ? { ...base, animationDuration: 800, animationEasing: 'cubicOut' }
      : { ...base, animation: false }
  }, [points, firstRef])
  return (
    <ReactECharts
      option={option}
      style={{ height: 220, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
