// Empacota main e preload (CJS) com esbuild. O renderer é construído pelo Vite.
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const producao = process.argv.includes('--prod')

const comum = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: !producao,
  minify: producao,
  external: ['electron', 'better-sqlite3'],
  alias: { '@shared': path.join(raiz, 'src/shared') },
  logLevel: 'info',
}

await build({ ...comum, entryPoints: [path.join(raiz, 'src/main/main.ts')], outfile: path.join(raiz, 'dist/main/main.cjs') })
await build({ ...comum, entryPoints: [path.join(raiz, 'src/preload/preload.ts')], outfile: path.join(raiz, 'dist/preload/preload.cjs') })
