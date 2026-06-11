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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
