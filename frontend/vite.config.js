import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split large vendor libraries into their own chunks so the browser
        // can cache them independently from your app code.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-pdf':   ['jspdf'],
          'vendor-misc':  ['lucide-react', 'react-hook-form', 'react-select'],
        },
      },
    },
    // Raise the warning threshold slightly — our pages are intentionally rich.
    // The real fix is the code-splitting above, not hiding the warning.
    chunkSizeWarningLimit: 600,
  },
})
