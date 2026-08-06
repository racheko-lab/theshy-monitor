import { motion } from 'framer-motion';

export default function LoadingBar({ isLoading }) {
  return (
    <motion.div
      className="loading-bar"
      initial={{ width: 0 }}
      animate={{ width: isLoading ? '90%' : '100%' }}
      transition={{ duration: isLoading ? 15 : 0.3 }}
      style={{ opacity: isLoading ? 1 : 0 }}
    />
  );
}
