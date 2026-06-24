import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Camporé Points',
        short_name: 'CampPoints',
        description: 'App de puntuación para el Camporé',
        theme_color: '#F58220',
        background_color: '#F3F4F6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'logo-transformados.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,jpeg,svg,png,woff2}']
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
})
