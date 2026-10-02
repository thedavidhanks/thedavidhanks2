import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind 0.0.0.0 so the dev server is reachable from the host through the
    // devcontainer's forwarded port (see .devcontainer/devcontainer.json).
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.jsx'],
    // Component tests are .js/.jsx only. src/lib/**/*.test.ts belongs to the
    // dependency-free `node --test` suite (npm test) and must never be picked
    // up here; the exclude is belt-and-braces in case a .jsx test lands there.
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['src/lib/**'],
  },
})
