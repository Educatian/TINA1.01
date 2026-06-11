import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SECURITY: AI API keys are NEVER defined into the client bundle. All Gemini /
// HuggingFace traffic goes through netlify/functions/ai-proxy.mts, which reads
// the keys from server-side env. Run `netlify dev` locally so the function is
// served alongside Vite.
export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          // Split stable third-party code into its own long-cached chunks so a
          // routine app change does not force users to re-download React +
          // Supabase + the router on every deploy.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
