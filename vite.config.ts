/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: { port: 5173, host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/lib/testSetup.ts'],
    // Фоновые задачи Claude Code разворачивают копию репозитория
    // в `.claude/worktrees/`. Без этой строки прогон подхватывает и её
    // — тесты идут дважды, а недоделанная работа соседней ветки
    // валится здесь и выглядит как поломка своей.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/worktrees/**'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
});
