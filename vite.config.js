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
})