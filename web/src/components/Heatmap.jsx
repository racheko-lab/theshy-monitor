import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

function getIntensityClass(count) {
  if (count === 0) return 'bg-border/30';
  if (count <= 1) return 'bg-accent/20';
  if (count <= 3) return 'bg-accent/40';
  if (count <= 5) return 'bg-accent/60';
  return 'bg-accent';
}

function generateHeatmapFromEvents(events, monthsBack = 6) {
  const months = [];
  const now = new Date();

  // Create a map of date -> event count
  const eventCounts = {};
  (events || []).forEach(e => {
    if (!e.timestamp) return;
    const dateStr = new Date(e.timestamp).toISOString().slice(0, 10);
    eventCounts[dateStr] = (eventCounts[dateStr] || 0) + 1;
  });

  for (let m = monthsBack - 1; m >= 0; m--) {
    const month = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthName = month.toLocaleDateString('zh-CN', { month: 'short' });
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days = [];
    let totalActive = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const isPast = date <= now;
      const dateStr = date.toISOString().slice(0, 10);
      const count = isPast ? (eventCounts[dateStr] || 0) : 0;
      const active = count > 0;
      if (active) totalActive++;
      days.push({ day: d, count, active });
    }

    months.push({
      name: monthName.replace('月', ''),
      days,
      totalActive,
      monthNum: month.getMonth() + 1,
      year: month.getFullYear(),
    });
  }
  return months;
}

export default function Heatmap({ events }) {
  const [expandedMonth, setExpandedMonth] = useState(null);
  const months = useMemo(() => generateHeatmapFromEvents(events, 6), [events]);

  const maxActive = Math.max(...months.map(m => m.totalActive), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="relative z-10"
    >
      <h2 className="text-xl font-semibold mb-6 text-text flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        历史记录
      </h2>

      <div className="glass-card p-6">
        <div className="space-y-3">
          {months.map((month, mi) => {
            const barWidth = Math.max((month.totalActive / maxActive) * 100, month.totalActive > 0 ? 5 : 0);
            const isExpanded = expandedMonth === mi;
            return (
              <motion.div
                key={mi}
                className="cursor-pointer group"
                onClick={() => setExpandedMonth(isExpanded ? null : mi)}
              >
                <div className="flex items-center gap-4">
                  <span className="text-text-secondary text-sm w-10 font-medium">{month.name}月</span>
                  <div className="flex-1 h-8 bg-border/20 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * mi, ease: 'easeOut' }}
                      className="h-full rounded-lg bg-gradient-to-r from-accent/40 to-accent group-hover:from-accent/60 group-hover:to-accent/80 transition-all"
                    />
                    <span className="absolute inset-0 flex items-center px-3 text-xs text-text-secondary">
                      {month.totalActive} 天活跃
                    </span>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-text-secondary text-lg"
                  >
                    ›
                  </motion.span>
                </div>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 pl-14 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1">
                      {month.days.map((d, di) => (
                        <motion.div
                          key={di}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: di * 0.01 }}
                          className={`heatmap-cell ${getIntensityClass(d.count)}`}
                          title={`${month.name}月${d.day}日: ${d.count}次活动`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs text-text-secondary">
                      <span>少</span>
                      <div className="flex gap-1">
                        <div className="heatmap-cell bg-border/30" />
                        <div className="heatmap-cell bg-accent/20" />
                        <div className="heatmap-cell bg-accent/40" />
                        <div className="heatmap-cell bg-accent/60" />
                        <div className="heatmap-cell bg-accent" />
                      </div>
                      <span>多</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
