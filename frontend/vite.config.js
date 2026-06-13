import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = (env.VITE_API_URL && env.VITE_API_URL !== '/api') ? env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://127.0.0.1:8000'
  
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // ws:true lets the interactive console WebSocket pass through to FastAPI
        '/api': { target: apiTarget, changeOrigin: true, ws: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
