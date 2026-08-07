import type { Variants } from 'framer-motion'

// ============================================================
// 全局常量 — 设计令牌的 TS 镜像 + 业务配置
// 组件只引用这里，禁止散落魔法值。
// ============================================================

/** 自动刷新频率（毫秒） */
export const REFRESH_INTERVAL = 30_000

/** 首屏数据内联注入的全局变量名（build.py 注入） */
export const INLINE_DATA_KEY = '__INITIAL_DATA__'

/** 段位 → 强调色（高级灰 + 单点强调，避免彩虹色） */
export const TIER_COLOR: Record<string, string> = {
  CHALLENGER: '#f0b232',
  GRANDMASTER: '#ff4d4f',
  MASTER: '#ff4d4f',
  DIAMOND: '#4f8cff',
  EMERALD: '#4ade80',
  PLATINUM: '#4ade80',
  GOLD: '#fbbf24',
  SILVER: '#999999',
  BRONZE: '#b06a45',
  IRON: '#6b6b70',
}

export function tierColor(tier?: string): string {
  if (!tier) return 'var(--color-text-secondary)'
  return TIER_COLOR[tier.toUpperCase()] ?? 'var(--color-primary)'
}

/** 段位中文（保持克制，仅在必要时本地化） */
export const TIER_LABEL_CN: Record<string, string> = {
  CHALLENGER: '王者',
  GRANDMASTER: '宗师',
  MASTER: '大师',
  DIAMOND: '钻石',
  EMERALD: '翡翠',
  PLATINUM: '铂金',
  GOLD: '黄金',
  SILVER: '白银',
  BRONZE: '青铜',
  IRON: '黑铁',
}

export function tierLabelCn(tier?: string): string {
  if (!tier) return ''
  return TIER_LABEL_CN[tier.toUpperCase()] ?? tier
}

// ============================================================
// 动画 Token（与 index.css 中 --dur-* / --ease-* 对齐）
// ease-out · 200~400ms · 无 bounce / 无 elastic
// ============================================================
export const EASE_OUT = [0.22, 1, 0.36, 1] as const

/** 区块进入：opacity + translateY + blur，依次 stagger */
export const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE_OUT },
  },
}

export const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: EASE_OUT },
  },
}

/** 卡片 Hover：scale 1.02 + 浮起（阴影/边框由 .glass-hover 的 CSS 处理） */
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { duration: 0.3, ease: EASE_OUT } },
}
