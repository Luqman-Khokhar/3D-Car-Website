import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // three + @react-three are one chunk on purpose: Rolldown merges them anyway
    // (nothing loads one without the other), and the whole 3D layer is behind a
    // dynamic import in App.tsx so the shell paints before this chunk arrives.
    // ~900kB raw / ~240kB gzip is the floor for a three.js scene, so the default
    // 500kB warning is noise here.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Function form (not the object map) because Vite 8's Rolldown types only accept a fn.
        manualChunks(id: string) {
          if (id.includes('node_modules/gsap')) return 'gsap'
          return undefined
        },
      },
    },
  },
})
