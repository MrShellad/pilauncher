import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          if (normalizedId.includes('/skinview3d')) {
            return 'skinviewer-vendor'
          }

          if (normalizedId.includes('/three/examples/jsm/')) {
            return 'three-examples'
          }

          if (normalizedId.includes('/three/build/') || normalizedId.includes('/three/src/')) {
            return 'three-core'
          }

          if (normalizedId.includes('/framer-motion/')) {
            return 'motion-vendor'
          }

          if (normalizedId.includes('/lucide-react/')) {
            return 'icons-vendor'
          }

          if (normalizedId.includes('/@tauri-apps/')) {
            return 'tauri-vendor'
          }

          if (normalizedId.includes('/react-dom/') || normalizedId.includes('/react-router-dom/')) {
            return 'react-runtime'
          }

          if (
            normalizedId.includes('/react/') ||
            normalizedId.includes('/scheduler/') ||
            normalizedId.includes('/use-sync-external-store/')
          ) {
            return 'react-core'
          }

          if (
            normalizedId.includes('/i18next/') ||
            normalizedId.includes('/react-i18next/') ||
            normalizedId.includes('/zustand/')
          ) {
            return 'app-state-vendor'
          }

          if (normalizedId.includes('/@noriginmedia/norigin-spatial-navigation/')) {
            return 'focus-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    watch: {
      ignored: ['**/flatpak/**']
    }
  }
})
