import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Short git commit of the current tree, or an empty string outside a repo. */
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: rootDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'nogit'
  }
}

/** Build version, e.g. `1.0.0+3e74266-20261011134931`. */
function buildVersion(): string {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)
  return `1.0.0+${gitCommit()}-${stamp}`
}

/**
 * Bakes the build version into the bundle (`__APP_VERSION__`) and into
 * `index.html` as a meta tag, so a running client can poll `index.html` and
 * detect when a newer build has been deployed.
 */
function versionPlugin(version: string): Plugin {
  return {
    name: 'nexa-version',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <meta name="app-version" content="${version}" />\n  </head>`,
      )
    },
    // The service worker is copied verbatim from public/, so stamp the build
    // version here: every deploy then opens a fresh cache and the activate
    // handler drops the previous one, instead of serving purged hashed chunks.
    writeBundle(options) {
      const file = path.join(
        path.resolve(options.dir ?? path.resolve(rootDir, 'dist')),
        'sw.js',
      )
      if (!fs.existsSync(file)) return
      const source = fs.readFileSync(file, 'utf8')
      if (!source.includes('__BUILD_VERSION__')) return
      fs.writeFileSync(file, source.replace('__BUILD_VERSION__', version))
    },
  }
}

const version = buildVersion()

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), versionPlugin(version)],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@radix-ui')) return 'radix'
          if (id.includes('react') || id.includes('scheduler')) return 'vendor'
          return undefined
        },
      },
    },
  },
})
