import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// V2 独立构建：输出到仓库根的 v2/ 目录（GitHub Pages 子路径 /v2/）
// base 使用相对路径，保证 /v2/ 子路径下资源可正确加载
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  build: {
    outDir: '../v2',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
