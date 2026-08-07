import { AnimatePresence, motion } from 'framer-motion'
import { EASE_OUT } from '@/constants'

interface LoadingBarProps {
  /** 刷新进行中时显示不确定进度条 */
  active: boolean
}

/** LoadingBar — 顶部 2px 细线，刷新时滑过 */
export function LoadingBar({ active }: LoadingBarProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full w-1/3 rounded-full bg-[var(--color-primary)]"
            initial={{ x: '-100%' }}
            animate={{ x: '300%' }}
            transition={{ duration: 1.1, ease: EASE_OUT, repeat: Infinity }}
            style={{ boxShadow: '0 0 12px var(--color-primary)' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
