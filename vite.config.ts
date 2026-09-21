import { defineConfig } from 'vite'
import path from 'path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/main'),
            rollupOptions: {
              external: [
                '@prisma/client',
                '.prisma/client',
                '@node-rs/argon2',
                'sqlite3',
                'better-sqlite3',
                'winston',
                'winston-daily-rotate-file'
              ]
            }
          }
        }
      },
      preload: {
        input: path.resolve(__dirname, 'src/preload/index.ts'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron/preload')
          }
        }
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@preload': path.resolve(__dirname, 'src/preload'),
    },
  },
  root: 'src/renderer',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
