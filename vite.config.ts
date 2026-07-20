import { defineConfig } from 'vite'
import { realpathSync } from 'node:fs'
import path from 'path'
import { tuuruStylesheetRecovery } from './scripts/stylesheet-recovery.mjs'

const projectRoot = realpathSync(__dirname)

export default defineConfig({
  plugins: [tuuruStylesheetRecovery()],
  root: projectRoot,
  base: './',
  cacheDir: path.resolve(projectRoot, '.vite/editor'),
  server: {
    port: 8765,
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    rollupOptions: {
      input: {
        main: path.resolve(projectRoot, 'index.html'),
        reader: path.resolve(projectRoot, 'reader/index.html'),
      },
    },
  },
})
