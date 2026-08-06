import { motion } from 'framer-motion';
import { RefreshCw, Radio, Video, MessageCircle, Swords } from 'lucide-react';

function formatTimeAgo(date) {
  if (!date) return '从未';
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return `${Math.floor(diff / 86400)}天前`;
}

export default function Hero({ data, onRefresh, isRefreshing, lastUpdate }) {
  const bilibili = data?.bilibili || {};
  const isLive = bilibili.is_live === true;
  const timeAgo = formatTimeAgo(lastUpdate);

  const quickLinks = [
    { icon: Radio, label: '直播', href: bilibili.room_id ? `https://live.bilibili.com/${bilibili.room_id}` : 'https://live.bilibili.com', active: isLive },
    { icon: Video, label: '视频', href: 'https://space.bilibili.com' },
    { icon: MessageCircle, label: '微博', href: 'https://weibo.com' },
    { icon: Swords, label: '战绩', href: 'https://op.gg' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      className="text-center py-16 md:py-24 relative z-10"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-6"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-2">
          <span className="bg-gradient-to-r from-white via-white to-text-secondary bg-clip-text text-transparent">
            TheShy Monitor
          </span>
        </h1>
        <p className="text-text-secondary text-lg">实时监控 TheShy 的所有动态</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="flex items-center justify-center gap-3 mb-8"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-live animate-pulse' : 'bg-success'}`} />
          <span className="text-text-secondary text-sm">{isLive ? '直播中' : '在线'}</span>
        </div>
        <span className="text-border">•</span>
        <span className="text-text-secondary text-sm">最后更新 {timeAgo}</span>
        <span className="text-border">•</span>
        <span className="text-text-secondary text-sm">刷新频率 30s</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="flex items-center justify-center gap-3 flex-wrap"
      >
        {quickLinks.map((link, i) => (
          <motion.a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all ${
              link.active
                ? 'bg-live/10 border-live/30 text-live shadow-lg shadow-live/20'
                : 'bg-card/50 border-border text-text-secondary hover:text-text hover:border-border-hover'
            }`}
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <link.icon size={16} />
            <span className="text-sm font-medium">{link.label}</span>
          </motion.a>
        ))}
        <motion.button
          onClick={onRefresh}
          whileHover={{ scale: 1.05, rotate: isRefreshing ? 360 : 0 }}
          whileTap={{ scale: 0.95 }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={{ duration: isRefreshing ? 1 : 0.2 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <RefreshCw size={16} />
          <span className="text-sm font-medium">{isRefreshing ? '刷新中' : '刷新'}</span>
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
