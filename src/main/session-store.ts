import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { SessionStore } from './ipc/handlers'

/**
 * Guarda o token de "Manter conectado" em `session.bin`, cifrado com o cofre do sistema (DPAPI no Windows).
 * Se a cifragem não estiver disponível, nada é gravado em disco e o login é pedido a cada abertura.
 */
export function createSessionStore(userDataPath: string): SessionStore {
  const file = path.join(userDataPath, 'session.bin')
  return {
    save(token) {
      if (!safeStorage.isEncryptionAvailable()) return
      fs.writeFileSync(file, safeStorage.encryptString(token))
    },
    load() {
      try {
        if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file)) return null
        return safeStorage.decryptString(fs.readFileSync(file))
      } catch {
        return null
      }
    },
    clear() {
      fs.rmSync(file, { force: true })
    },
  }
}
