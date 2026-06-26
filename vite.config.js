import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PROXY = {
  '/api-skillhub': {
    target: 'https://api.skillhub.cn',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api-skillhub/, '/api/v1'),
  },
  '/api-glama': {
    target: 'https://glama.ai',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api-glama/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: PROXY },
  preview: { proxy: PROXY },
})
