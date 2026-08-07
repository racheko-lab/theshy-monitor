import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import type { AppEvent } from '@/types'
import { buildHistory, type HistoryMonth } from '@/utils/data'
import { clock, dateShort, dayKey } from '@/utils/time'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { Tag } from '@/components/ui/Tag'

function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function dayCellColor(count: number): string {
  if (count <= 0) return 'rgba(255,255,255,0.04)'
  const alpha = Math.min(1, 0.18 + count * 0.22)
  return `rgba(79,140,255,${alpha.toFixed(2)})`
}

function MonthRow({ month, todayKey }: { month: HistoryMonth; todayKey: string }) {
  const [open, setOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [y, m] = month.key.split('-').map(Number)
  const total = daysInMonth(month.key)
  const cells = Array.from({ length: total }, (_, i) => {
    const dd = String(i + 1).padStart(2, '0')
    return { key: `${y}-${String(m).padStart(2, '0')}-${dd}`, count: month.days[`${y}-${String(m).padStart(2, '0')}-${dd}`] ?? 0 }
  })

  const dayItems = useMemo(
    () => (selectedDay ? month.items.filter((it) => dayKey(it.timestamp) === selectedDay) : []),
    [selectedDay, month.items],
  )
  const dayCount = selectedDay ? month.days[selectedDay] ?? 0 : 0

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <div className="text-h3 text-text">{month.label}</div>
          <div className="mt-0.5 text-caption text-tertiary">{month.total} 次动态</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden gap-1 sm:flex">
            {cells.slice(-14).map((c) => (
              <span
                key={c.key}
                className="h-3 w-3 rounded-[3px]"
                style={{
                  backgroundColor: dayCellColor(c.count),
                  boxShadow: c.key === todayKey ? '0 0 0 1.5px var(--color-primary)' : undefined,
                }}
                title={`${c.key}: ${c.count} 次动态`}
              />
            ))}
          </div>
          <ChevronDown
            size={18}
            className="text-secondary transition-transform duration-300"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </button>

      {selectedDay && (
        <div className="border-t border-[var(--color-border)] px-5 py-3">
          <div className="flex items-center gap-2 text-caption">
            <span className="font-medium text-text">
              {dateShort(selectedDay)} · {dayCount} 次动态
            </span>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="ml-auto text-tertiary transition-colors duration-200 hover:text-text"
            >
              关闭
            </button>
          </div>
          {dayItems.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {dayItems.map((it) => (
                <div key={it.key} className="flex items-center gap-2 text-caption">
                  <span className="w-12 shrink-0 tabular-nums text-tertiary">{clock(it.timestamp)}</span>
                  <span className="flex-1 truncate text-text">{it.title}</span>
                  {it.slug === 'smurf' && <Tag>小号</Tag>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--color-border)] px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-1">
                {cells.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelectedDay(c.key)}
                    className="h-3.5 w-3.5 rounded-[3px] transition-transform duration-150 hover:scale-125"
                    style={{
                      backgroundColor: dayCellColor(c.count),
                      boxShadow:
                        c.key === todayKey
                          ? '0 0 0 1.5px var(--color-primary)'
                          : c.key === selectedDay
                            ? '0 0 0 1.5px var(--color-text-secondary)'
                            : undefined,
                    }}
                    title={`${c.key}: ${c.count} 次动态`}
                    aria-label={`${c.key}: ${c.count} 次动态`}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                {month.items.slice(0, 12).map((it) => (
                  <div key={it.key} className="flex items-center gap-2 text-caption">
                    <span className="w-12 shrink-0 tabular-nums text-tertiary">
                      {dateShort(it.timestamp)}
                    </span>
                    <span className="flex-1 truncate text-text">{it.title}</span>
                    {it.slug === 'smurf' && <Tag>小号</Tag>}
                    <span className="shrink-0 tabular-nums text-tertiary">
                      {clock(it.timestamp)}
                    </span>
                  </div>
                ))}
                {month.items.length > 12 && (
                  <div className="text-xs text-tertiary">
                    其余 {month.items.length - 12} 条…
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Heatmap({ events }: { events: AppEvent[] }) {
  const months = useMemo(() => buildHistory(events, 6), [events])
  const todayKey = useMemo(() => dayKey(new Date().toISOString()), [])
  return (
    <section id="history" className="mx-auto max-w-3xl px-6 py-16">
      <SectionTitle eyebrow="History" title="历史记录" />
      <div className="flex flex-col gap-3">
        {months.map((m) => (
          <MonthRow key={m.key} month={m} todayKey={todayKey} />
        ))}
      </div>
    </section>
  )
}
