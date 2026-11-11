// Las pantallas ya están listas en public/: Vite solo las copia a dist/.
import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist', emptyOutDir: true, modulePreload: { polyfill: false } } });
