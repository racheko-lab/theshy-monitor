import { motion } from 'framer-motion';
import { Radio, Swords, TrendingUp, Trophy } from 'lucide-react';
import { CountUp } from 'countup.js';
import { useEffect, useRef } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatusCard({ icon: Icon, title, status, subtitle, color, delay, value, suffix, statusColor }) {
  const countRef = useRef(null);
  const countUpRef = useRef(null);

  useEffect(() => {
    if (value !== undefined && value !== null && countRef.current) {
      if (countUpRef.current) {
        countUpRef.current.update(value);
      } else {
        countUpRef.current = new CountUp(countRef.current, value, {
          duration: 1.5,
          useEasing: true,
          useGrouping: true,
          separator: ',',
        });
        if (!countUpRef.current.error) {
          countUpRef.current.start();
        }
      }
    }
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4, scale: 1.02 }}
      className="glass-card p-6 cursor-pointer group relative overflow-hidden"
    >
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: `radial-gradient(circle, ${color}20 0%, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300"
            style={{ background: `${color}15`, color: color }}
          >
            <Icon size={20} />
          </div>
        </div>
        <h3 className="text-text-secondary text-sm font-medium mb-1">{title}</h3>
        <div className="flex items-baseline gap-1">
          {value !== undefined ? (
            <span ref={countRef} className="countup text-3xl font-bold text-text">0</span>
          ) : (
            <span className="text-2xl font-semibold text-text" style={{ color: statusColor || 'inherit' }}>{status}</span>
          )}
          {suffix && <span className="text-text-secondary text-sm">{suffix}</span>}
        </div>
        <p className="text-text-secondary text-sm mt-1">{subtitle}</p>
      </div>
    </motion.div>
  );
}

const TIER_NAMES = {
  'CHALLENGER': 'Challenger',
  'GRANDMASTER': 'Grandmaster',
  'MASTER': 'Master',
  'DIAMOND': 'Diamond',
  'PLATINUM': 'Platinum',
  'GOLD': 'Gold',
  'SILVER': 'Silver',
  'BRONZE': 'Bronze',
  'IRON': 'Iron',
};

const TIER_COLORS = {
  'CHALLENGER': '#FF4D4F',
  'GRANDMASTER': '#F0C040',
  'MASTER': '#C084FC',
  'DIAMOND': '#4F8CFF',
};

export default function StatusCards({ data, events }) {
  const bilibili = data?.bilibili || {};
  const isLive = bilibili.is_live === true;
  const account = data?.accounts?.[0] || {};
  const profile = account?.profile || {};
  const soloranked = profile?.league_stats?.find(s => s.game_type === 'SOLORANKED');
  const totalGames = soloranked?.play || (soloranked?.win || 0) + (soloranked?.lose || 0);
  const recentMatches = events?.filter(e => e.type === 'new_match') || [];

  const tier = soloranked?.tier;
  const tierName = TIER_NAMES[tier] || tier || 'Unranked';
  const tierColor = TIER_COLORS[tier] || '#999';
  const rank = profile?.ladder_rank?.rank;
  const region = account?.region || 'KR';
  const lp = soloranked?.lp || 0;
  const wins = soloranked?.win || 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const lpChanges = events?.filter(e => e.type === 'lp_changed') || [];
  const recentLpChange = lpChanges[0];
  const lpDelta = recentLpChange?.delta || 0;

  const cards = [
    {
      icon: Radio,
      title: 'Live',
      status: isLive ? 'Live Now' : 'Offline',
      subtitle: isLive ? (bilibili.title || '直播中') : (bilibili.live_time ? `上次直播 ${timeAgo(bilibili.live_time)}` : '暂无直播记录'),
      color: isLive ? '#FF4D4F' : '#666',
      statusColor: isLive ? '#FF4D4F' : '#999',
    },
    {
      icon: Swords,
      title: 'Matches',
      value: totalGames,
      suffix: totalGames === 1 ? 'game' : 'games',
      subtitle: `胜率 ${winRate}% · 最近${recentMatches.length > 0 ? ` ${timeAgo(recentMatches[0].timestamp)}` : ''}`,
      color: '#4F8CFF',
    },
    {
      icon: TrendingUp,
      title: 'LP',
      value: lp,
      suffix: 'LP',
      subtitle: lpDelta > 0 ? `近期 +${lpDelta} LP` : (lpDelta < 0 ? `近期 ${lpDelta} LP` : 'Grandmaster'),
      color: lpDelta >= 0 ? '#4ADE80' : '#FF4D4F',
    },
    {
      icon: Trophy,
      title: 'Rank',
      status: tierName,
      subtitle: rank ? `${region} #${rank}` : `${lp} LP`,
      color: tierColor,
      statusColor: tierColor,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
      {cards.map((card, i) => (
        <StatusCard key={card.title} {...card} delay={0.1 + i * 0.1} />
      ))}
    </div>
  );
}
