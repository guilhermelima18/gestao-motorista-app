// Gera o instalador assinado com o certificado de certs/ (criado por scripts/criar-certificado.ps1).
// Para um certificado pago, defina CSC_LINK e CSC_KEY_PASSWORD no ambiente e use `npm run dist` direto.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pfx = path.join(raiz, 'certs/gestao-motorista.pfx')
const senhaArquivo = path.join(raiz, 'certs/senha.txt')

if (!fs.existsSync(pfx) || !fs.existsSync(senhaArquivo)) {
  console.error('Certificado não encontrado em certs/. Rode: powershell -ExecutionPolicy Bypass -File scripts/criar-certificado.ps1')
  process.exit(1)
}

const env = { ...process.env, CSC_LINK: pfx, CSC_KEY_PASSWORD: fs.readFileSync(senhaArquivo, 'utf8').trim() }
const resultado = spawnSync('npm', ['run', 'dist'], { cwd: raiz, env, stdio: 'inherit', shell: true })
process.exit(resultado.status ?? 1)
