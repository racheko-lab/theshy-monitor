import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CountUp } from 'countup.js';

function StatCard({ label, value, suffix, delay, children }) {
  const countRef = useRef(null);
  const countUpRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== null && countRef.current) {
      const timer = setTimeout(() => {
        if (countUpRef.current) {
          countUpRef.current.update(value);
        } else {
          countUpRef.current = new CountUp(countRef.current, value, {
            duration: 2,
            useEasing: true,
          });
          if (!countUpRef.current.error) {
            countUpRef.current.start();
          }
        }
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card p-5"
    >
      <p className="text-text-secondary text-sm mb-2">{label}</p>
      <div className="flex items-baseline gap-1">
        <span ref={countRef} className="countup text-3xl font-bold text-text">0</span>
        {suffix && <span className="text-text-secondary text-sm">{suffix}</span>}
      </div>
      {children}
    </motion.div>
  );
}

function MiniLineChart({ data, labels, color, height = 120, showZeroLine = false }) {
  const width = 600;
  const padding = { top: 10, right: 10, bottom: 25, left: 35 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (!data || data.length === 0) return null;

  const displayData = data.slice(-8);
  const displayLabels = labels ? labels.slice(-8) : displayData.map((_, i) => `${i + 1}`);
  const dataMax = Math.max(...displayData);
  const dataMin = Math.min(...displayData);
  const maxVal = Math.max(dataMax, 0) * 1.2;
  const minVal = Math.min(dataMin, 0) * 1.2;
  const range = maxVal - minVal || 1;

  const points = displayData.map((v, i) => {
    const x = padding.left + (i / Math.max(displayData.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((v - minVal) / range) * chartH;
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const zeroY = padding.top + chartH - ((0 - minVal) / range) * chartH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = padding.top + chartH * ratio;
        const val = Math.round(maxVal - range * ratio);
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            <text x={padding.left - 8} y={y + 4} fill="#999" fontSize="10" textAnchor="end">{val}</text>
          </g>
        );
      })}
      
      {showZeroLine && minVal < 0 && (
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      )}

      {points.map((p, i) => (
        <text key={i} x={p.x} y={height - 8} fill="#999" fontSize="10" textAnchor="middle">
          {displayLabels[i] || ''}
        </text>
      ))}

      <motion.path
        d={areaPath}
        fill={`url(#grad-${color.replace('#', '')})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: 'easeOut' }}
      />

      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={color}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, delay: 1 + i * 0.1 }}
        />
      ))}
    </svg>
  );
}

function aggregateDataByDay(events, daysBack = 14) {
  const now = new Date();
  const result = [];
  const labels = [];
  const dateList = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;
    dateList.push(dateStr);
    labels.push(dayLabel);
    result.push(0);
  }

  events.forEach(e => {
    if (e.type === 'new_match') {
      const dateStr = new Date(e.timestamp).toISOString().slice(0, 10);
      const idx = dateList.indexOf(dateStr);
      if (idx !== -1) {
        result[idx]++;
      }
    }
  });

  return { data: result, labels };
}

function aggregateLPChangeByDay(events, daysBack = 8) {
  const now = new Date();
  const result = [];
  const labels = [];
  const dateList = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);
    dateList.push(dateStr);
    labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
    result.push(0);
  }

  events.forEach(e => {
    if (e.type === 'lp_changed') {
      const dateStr = new Date(e.timestamp).toISOString().slice(0, 10);
      const idx = dateList.indexOf(dateStr);
      if (idx !== -1) {
        result[idx] += e.delta || 0;
      }
    }
  });

  return { data: result, labels };
}

export default function Stats({ events, data }) {
  const account = data?.accounts?.[0] || {};
  const profile = account?.profile || {};
  const soloranked = profile?.league_stats?.find(s => s.game_type === 'SOLORANKED');

  const matchEvents = events?.filter(e => e.type === 'new_match') || [];
  const lpChangeEvents = events?.filter(e => e.type === 'lp_changed') || [];

  const wins = soloranked?.win || 0;
  const losses = soloranked?.lose || 0;
  const totalGames = soloranked?.play || wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const recentLpDelta = lpChangeEvents.length > 0 ? lpChangeEvents.slice(0, 10).reduce((sum, e) => sum + (e.delta || 0), 0) : 0;
  const recentGames = matchEvents.filter(e => {
    const eDate = new Date(e.timestamp);
    const now = new Date();
    return (now - eDate) < 24 * 60 * 60 * 1000;
  }).length;

  const matchChartData = useMemo(() => aggregateDataByDay(events || [], 8), [events]);
  const lpChartData = useMemo(() => aggregateLPChangeByDay(events || [], 8), [events]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="relative z-10"
    >
      <h2 className="text-xl font-semibold mb-6 text-text flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        数据统计
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="总对局" value={totalGames} suffix="场" delay={0.1} />
        <StatCard label="胜场" value={wins} suffix="胜" delay={0.15} />
        <StatCard label="LP" value={soloranked?.lp || 0} suffix="" delay={0.2}>
          {recentLpDelta !== 0 && (
            <p className={`text-xs mt-1 ${recentLpDelta > 0 ? 'text-success' : 'text-live'}`}>
              近期 {recentLpDelta > 0 ? '+' : ''}{recentLpDelta} LP
            </p>
          )}
        </StatCard>
        <StatCard label="胜率" value={winRate} suffix="%" delay={0.25}>
          <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${winRate}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-full rounded-full"
              style={{ background: winRate >= 50 ? '#4ADE80' : '#FF4D4F' }}
            />
          </div>
        </StatCard>
      </div>

      <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-sm text-text-secondary">每日对局数（近8天）</span>
            </div>
            <MiniLineChart data={matchChartData.data} labels={matchChartData.labels} color="#4F8CFF" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: '#F0C040' }} />
              <span className="text-sm text-text-secondary">每日 LP 变化（近8天）</span>
            </div>
            <MiniLineChart data={lpChartData.data} labels={lpChartData.labels} color="#F0C040" showZeroLine={true} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
