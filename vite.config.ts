import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Preload the two font faces the first screen needs (headings and figures in
// Space Grotesk 700, labels in Space Mono 400), so text does not reflow when
// they arrive. File names are hashed, so they are found in the bundle.
function preloadFonts(): Plugin {
  const wanted = [/space-grotesk-latin-700-normal-[\w-]+\.woff2$/, /space-mono-latin-400-normal-[\w-]+\.woff2$/]
  return {
    name: 'preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle ?? {})
        const tags = wanted
          .map((re) => files.find((f) => re.test(f)))
          .filter((f): f is string => !!f)
          .map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: './' + f, crossorigin: '' },
            injectTo: 'head' as const,
          }))
        return { html, tags }
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    preloadFonts(),
    VitePWA({
      // Registered by the app itself after sign-in (src/lib/pwa.ts), never for
      // visitors of the public catalogue, who should not download the editor.
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Project Spain',
        short_name: 'Project Spain',
        description: 'Költségvetés, hétvége, repjegy és költözés egy helyen.',
        lang: 'hu',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F6F4EF',
        theme_color: '#16202E',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell: code, styles, icons and the woff2 fonts. Data always
        // comes from the network; nothing from Supabase is cached here.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
