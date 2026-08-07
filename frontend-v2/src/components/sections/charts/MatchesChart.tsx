import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import type { SeriesPoint } from '@/utils/data'
import { axisCommon, tooltipCommon, baseGrid, axisLabelInterval } from './theme'
import { useFirstAnimation } from '@/hooks/useFirstAnimation'

/** 每日对局数 — 柱状图（细柱、主色、圆角） */
export default function MatchesChart({ data }: { data: SeriesPoint[] }) {
  const firstRef = useFirstAnimation()
  const option = useMemo<EChartsOption>(() => {
    const base: EChartsOption = {
      grid: baseGrid,
      tooltip: { ...tooltipCommon, valueFormatter: (v) => `${v} 场` },
      xAxis: {
        type: 'category',
        data: data.map((p) => p.date.slice(5)),
        ...axisCommon,
        axisLabel: { ...axisCommon.axisLabel, interval: axisLabelInterval(data.length) },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', ...axisCommon, splitLine: axisCommon.splitLine },
      series: [
        {
          type: 'bar',
          data: data.map((p) => p.value),
          barWidth: '55%',
          itemStyle: {
            color: '#4F8CFF',
            borderRadius: [3, 3, 0, 0],
          },
        },
      ],
    }
    return firstRef.current
      ? { ...base, animationDuration: 800, animationEasing: 'cubicOut' }
      : { ...base, animation: false }
  }, [data, firstRef])
  return (
    <ReactECharts
      option={option}
      style={{ height: 220, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
