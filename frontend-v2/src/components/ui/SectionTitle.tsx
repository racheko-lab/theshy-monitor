import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { sectionVariants } from '@/constants'

interface SectionTitleProps {
  eyebrow?: string
  title: string
  action?: ReactNode
}

/** SectionTitle — 区块标题（eyebrow 小标 + 主标题），统一节奏 */
export function SectionTitle({ eyebrow, title, action }: SectionTitleProps) {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-15% 0px' }}
      className="mb-8 flex items-end justify-between gap-4"
    >
      <div>
        {eyebrow && (
          <div className="mb-2 text-caption font-medium uppercase tracking-[0.18em] text-secondary">
            {eyebrow}
          </div>
        )}
        <h2 className="text-h2 text-text text-balance">{title}</h2>
      </div>
      {action}
    </motion.div>
  )
}
