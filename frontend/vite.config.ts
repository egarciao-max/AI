import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src', // Set root to src directory where index.html is located
  build: {
    outDir: '../dist', // Build to parent directory
    sourcemap: true,
    rollupOptions: {
      input: 'index.html', // Specify index.html as entry point (relative to root)
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
