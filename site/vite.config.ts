import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import license from 'rollup-plugin-license'

// Real static hosts (GitHub Pages included) resolve a directory request like
// /datasette/ to /datasette/index.html automatically. Vite's dev server only
// does that for the site root, so without this, public/datasette/ 404s in
// dev even though it works in a real build.
function serveDirectoryIndexes(): Plugin {
  return {
    name: 'serve-directory-indexes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.endsWith('/') && req.url !== '/') {
          const indexPath = path.join(server.config.publicDir, req.url, 'index.html')
          if (existsSync(indexPath)) {
            req.url += 'index.html'
          }
        }
        next()
      })
    },
  }
}

const vendoredDatasetteLiteNotice = [
  'Name: datasette-lite',
  'Version: (vendored static files, not an npm dependency)',
  'License: Apache-2.0',
  'Private: false',
  'Description: Runs Datasette (https://datasette.io/) entirely client-side via WebAssembly/Pyodide. Powers the /datasette/ historical-incident-database explorer.',
  'Repository: https://github.com/simonw/datasette-lite',
  'Homepage: https://lite.datasette.io/',
  'Notes: public/datasette/{index.html,app.css,webworker.js} are copied from the upstream repo, modified only to remove its Plausible analytics tag (which only activated on lite.datasette.io anyway) and to default the loaded database to our own history.db instead of upstream\'s demo databases. Upstream ships the bare Apache 2.0 template with no filled-in copyright holder or NOTICE file, so none is reproduced here beyond the license text itself.',
  'License Text:',
  '===',
  '',
  readFileSync(
    fileURLToPath(new URL('./public/datasette/LICENSE', import.meta.url)),
    'utf-8',
  ).trim(),
].join('\n')

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works whether it's served from a domain root
  // or a GitHub Pages project subpath (e.g. a fork's <user>.github.io/<repo>/).
  base: './',
  // 'spa' (the default) rewrites any extensionless request to /index.html,
  // which swallows public/datasette/ (a second static page, vendored from
  // datasette-lite) before it's ever served. There's no client-side router
  // relying on that fallback, so 'mpa' - multiple real HTML entry points,
  // which is what this app actually is now - is the correct type, not a
  // workaround.
  appType: 'mpa',
  plugins: [
    serveDirectoryIndexes(),
    react(),
    license({
      thirdParty: {
        output: {
          file: 'dist/THIRD-PARTY-NOTICES.txt',
          encoding: 'utf-8',
          // rollup-plugin-license only scans actual npm dependencies bundled
          // into the JS - it has no visibility into public/datasette/, which
          // is hand-vendored from a separate repo. Append it manually so the
          // Credits link stays a single, complete source of truth.
          template(dependencies) {
            const npmNotices = dependencies
              .map((d) => d.text())
              .join('\n\n---\n\n')
            return `${npmNotices}\n\n---\n\n${vendoredDatasetteLiteNotice}`
          },
        },
      },
    }),
  ],
})
