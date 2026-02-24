import path from 'path';
import { defineConfig, loadEnv } from 'vite';


export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'frontend/src'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
          input: 'frontend/src/index.html', // Specify index.html as entry point
          output: {
            manualChunks: {
              vendor: ['axios']
            }
          }
        },
        assetsInlineLimit: 4096,
        cssCodeSplit: true
      },
      publicDir: 'frontend/src'
    };
});
