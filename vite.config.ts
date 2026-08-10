import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Stage 2 fix: tests importing src/config/env.ts threw
    // "VITE_API_BASE_URL required in development mode" because the test
    // environment never provided the mandatory VITE_* variables.
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000',
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  build: { 
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'charts';
            }
            if (id.includes('pdfjs-dist') || id.includes('react-pdf')) {
              return 'pdf';
            }
            if (id.includes('@radix-ui')) {
              return 'radix';
            }
            if (id.includes('react-router-dom') || id.includes('lucide-react') || id.includes('axios')) {
              return 'vendor';
            }
            if (id.includes('/react/') || id.includes('/react-dom/')) {
              return 'react';
            }
          }
        }
      }
    }
  }
})
