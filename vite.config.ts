import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build works from any GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  // Safe here because routing is hash-based, so every asset request happens
  // from the app's root document.
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Keep the big, rarely-changing libraries in their own long-cached
        // chunks so app edits don't force browsers to re-download them, and the
        // browser can fetch vendor + app code in parallel.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
