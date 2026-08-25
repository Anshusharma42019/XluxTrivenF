import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_BASE_URL || ''
  
  // Detect if VITE_API_BASE_URL is pointing to xluxtriven.de (remote prod)
  // and automatically redirect to localhost:5000 to avoid CORS in local dev
  const isRemote = apiUrl.includes('xluxtriven.de')
  const proxyTarget = isRemote ? 'http://localhost:5000' : (apiUrl.replace('/api/v1', '') || 'http://localhost:5000')

  return {
    plugins: [
      react(),
      tailwindcss(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/ping': {
          target: proxyTarget,
          changeOrigin: true,
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor';
              }
              if (id.includes('axios')) {
                return 'axios';
              }
              return 'vendor-others';
            }
          }
        }
      }
    }
  }
})
