import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'frontend', // Set root to frontend directory
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: 'src/index.html', // Specify index.html as entry point
      output: {
        manualChunks: {
          vendor: ['axios']
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  }
});
