import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['finanzas.labeltech.com.ar'],
    proxy: {
      '/api': {
        target: 'http://backend:5001',
        changeOrigin: true,
      }
    }
  }
})