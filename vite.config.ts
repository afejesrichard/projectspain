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
  server: {
    host: true,
    port: 5173,
  },
})
