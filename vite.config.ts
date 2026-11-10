import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the built site works from any folder (such as GitHub Pages).
  base: './',
  plugins: [react()],
});
