import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      // Shim @testing-library/react for tests without adding dependency
      '@testing-library/react': path.resolve(__dirname, 'src/test-utils/testing-library-react.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit'],
          'vendor-dndkit': ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
  // Vitest configuration
  test: {
    // Use Node test environment to avoid external DOM dependencies in CI
    environment: 'node',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'src/test-utils/setup-tests.ts')],
  },
});
