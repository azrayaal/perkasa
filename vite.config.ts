import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Fallback file watcher.
 *
 * Beberapa mesin dev kehabisan kuota inotify (`ENOSPC: System limit for number
 * of file watchers reached`) karena dipakai VS Code + ekstensinya. Polling tidak
 * memakai inotify sama sekali, jadi dev server tetap bisa jalan | tapi lebih
 * boros CPU/baterai.
 *
 * Solusi permanen yang lebih baik (butuh sudo, sekali saja):
 *   echo -e "fs.inotify.max_user_watches=524288\nfs.inotify.max_user_instances=1024" \
 *     | sudo tee /etc/sysctl.d/99-inotify.conf && sudo sysctl --system
 *
 * Setelah itu matikan polling lewat env: `VITE_USE_POLLING=false npm run dev`.
 */
const usePolling = process.env.VITE_USE_POLLING !== 'false'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      usePolling,
      interval: 300,
      // Jangan poll folder besar yang tidak pernah diedit manual.
      ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    },
  },
})
