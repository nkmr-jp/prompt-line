import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  // Electron renderer process configuration
  root: 'src/renderer',
  base: './',
  
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: false, // Don't clear the entire dist/renderer (keep HTML and CSS)
    
    rollupOptions: {
      input: {
        // Main entry point
        renderer: resolve(__dirname, 'src/renderer/renderer.ts')
      },
      output: {
        // Generate a single bundle file
        entryFileNames: 'bundle.js',
        chunkFileNames: 'bundle.js',
        assetFileNames: 'bundle.js',
        // Use IIFE format for browser compatibility
        format: 'iife',
        name: 'PromptLineApp'
      },
      external: [] // Bundle everything
    },
    
    // Generate source maps for debugging
    sourcemap: true,
    
    // Minimize bundle size
    minify: false, // Keep readable for debugging
    
    // Target modern browsers (Electron)
    target: 'chrome120'
  },
  
  // Configure how imports are resolved
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@utils': resolve(__dirname, 'src/renderer/utils')
    }
  },
  
  // Plugin configuration
  plugins: [],
  
  // Development server (not used in Electron, but good to have)
  server: {
    port: 3000
  },
  
  // Disable CSS code splitting to keep everything in one file
  css: {
    codeSplit: false
  }
});