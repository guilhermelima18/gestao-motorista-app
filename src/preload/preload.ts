import { API_METHODS, channelName, type MotoristaApi } from '@shared/api'
import { contextBridge, ipcRenderer } from 'electron'

// Expõe apenas as funções da allowlist; o renderer nunca recebe o ipcRenderer nem canais genéricos.
const api: Record<string, Record<string, (input?: unknown) => Promise<unknown>>> = {}
for (const [group, methods] of Object.entries(API_METHODS)) {
  api[group] = {}
  for (const method of methods) {
    api[group]![method] = (input?: unknown) => ipcRenderer.invoke(channelName(group, method), input)
  }
}

contextBridge.exposeInMainWorld('api', api as unknown as MotoristaApi)
