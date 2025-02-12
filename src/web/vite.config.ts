import { defineConfig } from 'vite'; // ^4.3.9
import react from '@vitejs/plugin-react'; // ^4.0.0
import checker from 'vite-plugin-checker'; // ^0.6.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/graphql': 'http://localhost:8080/graphql',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    },
    cors: {
      origin: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    },
    hmr: {
      overlay: true,
      clientPort: 3000,
      timeout: 120000
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['d3', 'chart.js'],
          state: ['@reduxjs/toolkit', 'react-redux'],
          realtime: ['socket.io-client', 'rxjs'],
          utils: ['lodash', 'date-fns'],
          visualization: ['three.js', 'webgl']
        }
      }
    }
  },

  plugins: [
    react({
      fastRefresh: true,
      babel: {
        plugins: ['styled-components']
      }
    }),
    checker({
      typescript: true,
      overlay: true,
      enableBuild: true
    }),
    tsconfigPaths({
      loose: true
    })
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@interfaces': path.resolve(__dirname, 'src/interfaces'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@layouts': path.resolve(__dirname, 'src/layouts'),
      '@analytics': path.resolve(__dirname, 'src/analytics')
    }
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@reduxjs/toolkit',
      'react-redux',
      'd3',
      'socket.io-client',
      'rxjs',
      'lodash',
      'date-fns',
      'three.js'
    ],
    exclude: ['@internal/*']
  }
});