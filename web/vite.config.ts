import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/iryouhi-csv-converter/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
