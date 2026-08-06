import { motion } from 'framer-motion';
import { Code2, Activity, Package, GitBranch } from 'lucide-react';

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.8 }}
      className="relative z-10 py-12 border-t border-border/50 mt-16"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <a
              href="https://github.com/racheko-lab/theshy-monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-text transition-colors"
            >
              <Code2 size={14} />
              <span>GitHub</span>
            </a>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-success" />
              <span>API Status</span>
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-text-secondary">
            <div className="flex items-center gap-1.5">
              <Package size={14} />
              <span>v2026.08</span>
            </div>
            <div className="flex items-center gap-1.5">
              <GitBranch size={14} />
              <span>Powered by GitHub Actions</span>
            </div>
          </div>
        </div>

        <p className="text-center text-text-secondary/50 text-xs mt-6">
          TheShy Monitor · Real-time Dashboard
        </p>
      </div>
    </motion.footer>
  );
}
