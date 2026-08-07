import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import * as echarts from 'echarts'
import type { SeriesPoint } from '@/utils/data'
import { axisCommon, tooltipCommon, baseGrid, axisLabelInterval } from './theme'

/** 每日 LP 净变化 — 面积折线（成功色、细线、渐变填充） */
export default function LpChart({ data }: { data: SeriesPoint[] }) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: baseGrid,
      tooltip: { ...tooltipCommon, valueFormatter: (v) => `${v} LP` },
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
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: data.map((p) => p.value),
          lineStyle: { color: '#4ADE80', width: 2 },
          itemStyle: { color: '#4ADE80' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(74,222,128,0.28)' },
              { offset: 1, color: 'rgba(74,222,128,0)' },
            ]),
          },
        },
      ],
      animationDuration: 800,
      animationEasing: 'cubicOut',
    }),
    [data],
  )
  return (
    <ReactECharts
      option={option}
      style={{ height: 220, width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  )
}
