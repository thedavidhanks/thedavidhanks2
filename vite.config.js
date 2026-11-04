import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { isIndexable } from './scripts/site-env.ts'

// Only the production (master) build may be indexed; every other build gets
// noindex here and a Disallow-all robots.txt from scripts/build-seo.ts. The
// decision lives in scripts/site-env.ts. See docs/seo.md.
const noindexOffProduction = {
  name: 'noindex-off-production',
  transformIndexHtml: () =>
    isIndexable() ? [] : [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' }, injectTo: 'head' }],
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), noindexOffProduction],
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
    // Fixed so the component and the MSW handlers agree on the endpoint and no
    // test depends on a developer's .env. Values are not real.
    env: {
      VITE_AWS_APPLICATION_API_URL: 'https://application-api.test/Prod/application',
      VITE_AWS_APPLICATION_API_KEY: 'test-api-key',
    },
  },
})
