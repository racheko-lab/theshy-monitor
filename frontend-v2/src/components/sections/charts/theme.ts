import type { EChartsOption } from 'echarts'

// ============================================================
// 图表主题 — Apple Stocks / Linear Analytics 风格
// 高级灰、极少网格线、细线、无彩虹色、无大图例。
// ============================================================

export const axisCommon = {
  axisLine: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
  axisTick: { show: false },
  axisLabel: { color: '#999999', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' as const } },
}

export const tooltipCommon: EChartsOption['tooltip'] = {
  trigger: 'axis',
  backgroundColor: 'rgba(17,18,22,0.92)',
  borderColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  textStyle: { color: '#ffffff', fontSize: 12 },
  padding: [8, 12],
  axisPointer: { lineStyle: { color: 'rgba(255,255,255,0.12)' } },
}

export const baseGrid = { left: 6, right: 10, top: 18, bottom: 22, containLabel: true }

/** 30 天横轴标签过密，按数量抽稀 */
export function axisLabelInterval(n: number): number {
  return Math.max(0, Math.ceil(n / 6) - 1)
}
