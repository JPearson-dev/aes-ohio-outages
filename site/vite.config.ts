import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works whether it's served from a domain root
  // or a GitHub Pages project subpath (e.g. a fork's <user>.github.io/<repo>/).
  base: './',
  plugins: [react()],
})
