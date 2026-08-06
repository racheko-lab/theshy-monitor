import { motion } from 'framer-motion';
import { Radio, Swords, Trophy, AlertCircle, TrendingUp, TrendingDown, Gamepad2, Star } from 'lucide-react';
import { useMemo } from 'react';

const eventTypeConfig = {
  live_start: { icon: Radio, color: '#FF4D4F', label: '开播' },
  live_end: { icon: Radio, color: '#999', label: '下播' },
  game_start: { icon: Gamepad2, color: '#F97316', label: '进入对局' },
  game_end: { icon: Swords, color: '#4ADE80', label: '对局结束' },
  lp_changed: { icon: TrendingUp, color: '#F0C040', label: 'LP变化' },
  new_match: { icon: Swords, color: '#F97316', label: '新对局' },
  rank_changed: { icon: Trophy, color: '#C084FC', label: '段位变化' },
  level_changed: { icon: Star, color: '#4ADE80', label: '等级提升' },
  losing_streak: { icon: TrendingDown, color: '#FF4D4F', label: '连败' },
  winning_streak: { icon: TrendingUp, color: '#4ADE80', label: '连胜' },
  became_active: { icon: Gamepad2, color: '#F97316', label: '游戏中' },
  default: { icon: AlertCircle, color: '#999', label: '动态' },
};

const CHAMPION_ICON_MAP = {
  '皮城女警': 'https://opgg-static.akamaized.net/meta/images/lol/14.15.1/champion/Caitlyn.png',
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

const TIER_NAMES = {
  'IRON': '黑铁', 'BRONZE': '青铜', 'SILVER': '白银', 'GOLD': '黄金',
  'PLATINUM': '铂金', 'EMERALD': '翡翠', 'DIAMOND': '钻石',
  'MASTER': '大师', 'GRANDMASTER': '宗师', 'CHALLENGER': '王者',
};

function getEventText(event) {
  if (event.type === 'live_start' && event.title) return event.title;
  if (event.type === 'live_end' && event.duration) {
    const h = Math.floor(event.duration / 3600);
    const m = Math.floor((event.duration % 3600) / 60);
    return `直播时长 ${h}h${m}m`;
  }
  if (event.type === 'game_start' || event.type === 'became_active') {
    return `${event.account} 进入游戏`;
  }
  if (event.type === 'game_end') {
    return `${event.account} 结束对局`;
  }
  if (event.type === 'lp_changed') {
    const delta = event.delta > 0 ? `+${event.delta}` : event.delta;
    const color = event.delta > 0 ? '#4ADE80' : '#FF4D4F';
    const tierName = TIER_NAMES[event.tier] || event.tier || '';
    return (
      <span>
        {event.account} · {tierName} <span style={{ color }}>{delta} LP</span>
        {event.new_lp ? ` (${event.new_lp} LP)` : ''}
      </span>
    );
  }
  if (event.type === 'new_match') {
    const win = event.result === 'WIN';
    const color = win ? '#4ADE80' : '#FF4D4F';
    const champion = event.champion || event.champion_name || '?';
    const lenMin = event.game_length_second ? ` ${Math.round(event.game_length_second / 60)}m` : '';
    return (
      <span>
        {event.account} · <span style={{ color }}>{win ? '胜利' : '失败'}</span>
        {champion !== '?' ? ` · ${champion}` : ''}
        {event.kda ? ` · KDA ${event.kda}` : ''}
        {lenMin}
      </span>
    );
  }
  if (event.type === 'rank_changed') {
    const fromTier = TIER_NAMES[event.from_tier] || event.from_tier || '';
    const toTier = TIER_NAMES[event.to_tier] || event.to_tier || '';
    return `${fromTier} → ${toTier} ${event.lp_diff > 0 ? '+' : ''}${event.lp_diff || 0} LP`;
  }
  if (event.type === 'level_changed') {
    return `等级 ${event.old} → ${event.new}`;
  }
  if (event.type === 'losing_streak') return `${event.account} · ${event.streak}连败`;
  if (event.type === 'winning_streak') return `${event.account} · ${event.streak}连胜`;
  return event.message || event.title || '动态';
}

function processEvents(rawEvents) {
  if (!rawEvents || rawEvents.length === 0) return [];

  const sorted = [...rawEvents].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const result = [];

  for (const event of sorted) {
    const type = event.type;
    const slug = event.slug || 'main';
    const key = `${type}_${slug}_${event.timestamp?.slice(0, 16)}`;

    if (type === 'opgg_updated') {
      continue;
    }

    if (type === 'new_match') {
      result.push({
        ...event,
        _dedup_key: `match_${event.match_id || event.timestamp}`,
      });
      continue;
    }

    if (['lp_changed', 'became_active', 'losing_streak', 'winning_streak', 'level_changed', 'rank_changed', 'live_start', 'live_end'].includes(type)) {
      result.push({
        ...event,
        _dedup_key: key,
      });
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const e of result) {
    const k = e._dedup_key || `${e.type}_${e.slug}_${e.timestamp}`;
    if (!seen.has(k)) {
      seen.add(k);
      deduped.push(e);
    }
  }

  return deduped.slice(0, 25);
}

export default function Timeline({ events }) {
  const filteredEvents = useMemo(() => processEvents(events), [events]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.2 },
    },
  };

  const item = {
    hidden: { opacity: 0, x: -20, filter: 'blur(5px)' },
    show: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.4 } },
  };

  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  const groupedEvents = useMemo(() => {
    const groups = { today: [], yesterday: [], earlier: [] };
    for (const e of filteredEvents) {
      const d = new Date(e.timestamp).toDateString();
      if (d === today) groups.today.push(e);
      else if (d === yesterday) groups.yesterday.push(e);
      else groups.earlier.push(e);
    }
    return groups;
  }, [filteredEvents, today, yesterday]);

  const getChampionEmoji = (champion) => {
    const map = {
      '皮城女警': '🔫',
      '机械公敌': '🔥',
      '纳祖芒荣耀': '🛡️',
    };
    return map[champion] || '⚔️';
  };

  const renderEvent = (event, i, isEarlier = false) => {
    const cfg = eventTypeConfig[event.type] || eventTypeConfig.default;
    const Icon = cfg.icon;
    const isSmurf = event.slug === 'smurf';

    return (
      <motion.div key={i} variants={item} className="relative pl-10 pb-5 last:pb-0">
        <div
          className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-bg flex items-center justify-center"
          style={{
            background: cfg.color,
            boxShadow: `0 0 ${isEarlier ? '6px' : '12px'} ${cfg.color}${isEarlier ? '40' : '80'}`,
          }}
        >
          <Icon size={8} color="#fff" />
        </div>

        {isSmurf && (
          <div
            className="absolute left-[-2px] top-5 w-[3px] rounded-full"
            style={{ height: 'calc(100% - 20px)', background: 'linear-gradient(to bottom, #9994, transparent)' }}
          />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: `${cfg.color}15`, color: cfg.color }}
              >
                {cfg.label}
              </span>
              {isSmurf && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-text-secondary">
                  小号
                </span>
              )}
              <span className="text-text-secondary text-xs font-mono">
                {isEarlier ? `${new Date(event.timestamp).getMonth() + 1}月${new Date(event.timestamp).getDate()}日 ` : ''}
                {formatTime(event.timestamp)}
              </span>
            </div>
            <p className={`text-sm leading-relaxed ${isEarlier ? 'text-text-secondary' : 'text-text'}`}>
              {getEventText(event)}
            </p>
          </div>
          {event.champion && !isEarlier && (
            <span className="text-lg flex-shrink-0 mt-0.5">{getChampionEmoji(event.champion)}</span>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative z-10"
    >
      <h2 className="text-xl font-semibold mb-6 text-text flex items-center gap-2">
        <span className="w-1 h-5 bg-accent rounded-full" />
        时间轴
      </h2>

      <div className="glass-card p-6">
        {filteredEvents.length === 0 ? (
          <p className="text-text-secondary text-center py-8">暂无动态</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-accent/30 via-accent/10 to-transparent rounded-full" />

            <motion.div variants={container} initial="hidden" animate="show">
              {groupedEvents.today.length > 0 && (
                <>
                  <div className="mb-3 ml-10">
                    <span className="text-sm font-medium text-accent">Today</span>
                  </div>
                  {groupedEvents.today.map((e, i) => renderEvent(e, `today-${i}`))}
                </>
              )}

              {groupedEvents.yesterday.length > 0 && (
                <>
                  <div className="mb-3 ml-10 mt-4">
                    <span className="text-sm font-medium text-text-secondary">Yesterday</span>
                  </div>
                  {groupedEvents.yesterday.map((e, i) => renderEvent(e, `yest-${i}`))}
                </>
              )}

              {groupedEvents.earlier.length > 0 && (
                <>
                  <div className="mb-3 ml-10 mt-4">
                    <span className="text-sm font-medium text-text-secondary">Earlier</span>
                  </div>
                  {groupedEvents.earlier.map((e, i) => renderEvent(e, `earlier-${i}`, true))}
                </>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
