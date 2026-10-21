import { app, BrowserWindow, dialog, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { openDatabase } from './database/connection'
import { registerIpc } from './ipc/register'
import type { Db } from './services/common'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const RENDERER_FILE = path.join(__dirname, '../renderer/index.html')
const RENDERER_URL = DEV_SERVER_URL ?? pathToFileURL(RENDERER_FILE).toString()

let mainWindow: BrowserWindow | null = null
let db: Db | null = null

// Caminho fixo e sem acentos para o userData: os dados permanecem no mesmo lugar entre versões do aplicativo.
// GM_USER_DATA permite isolar os dados em desenvolvimento e testes; é ignorado no aplicativo empacotado.
const customUserData = !app.isPackaged ? process.env.GM_USER_DATA : undefined
app.setPath('userData', customUserData ?? path.join(app.getPath('appData'), 'gestao-motorista'))

function isTrustedUrl(url: string): boolean {
  return DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.split('#')[0] === RENDERER_URL
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Gestão do Motorista',
    // Empacotado, o ícone vem do executável; em desenvolvimento usa o PNG da pasta build.
    icon: app.isPackaged ? undefined : path.join(__dirname, '../../build/icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: Boolean(DEV_SERVER_URL),
    },
  })
  mainWindow.setMenuBarVisibility(false)
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Bloqueia navegação e novas janelas; links externos http(s) abrem no navegador padrão.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUrl(url)) event.preventDefault()
  })
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))

  void mainWindow.loadURL(RENDERER_URL)
}

async function saveFile(fileName: string, content: string) {
  const options = {
    title: 'Exportar CSV',
    defaultPath: path.join(app.getPath('documents'), fileName),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  }
  const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { cancelled: true }
  await fs.promises.writeFile(result.filePath, content, 'utf8')
  return { cancelled: false, path: result.filePath }
}

async function start(): Promise<void> {
  const userData = app.getPath('userData')
  const databasePath = path.join(userData, 'gestao-motorista.db')
  const backupsPath = path.join(userData, 'backups')

  try {
    db = openDatabase(databasePath, { backupFolder: backupsPath })
  } catch (error) {
    // Nunca recria nem apaga o banco: avisa o usuário e mantém o arquivo intacto para recuperação.
    console.error('[db] falha ao abrir o banco:', error)
    dialog.showErrorBox(
      'Não foi possível abrir os dados',
      `O banco de dados não pôde ser aberto e foi mantido intacto.\n\nArquivo: ${databasePath}\nBackups: ${backupsPath}\n\nFeche outras instâncias do aplicativo ou restaure um backup.`,
    )
    app.quit()
    return
  }

  registerIpc(
    { db, version: app.getVersion(), databasePath, backupsPath, saveFile },
    { getWebContents: () => mainWindow?.webContents ?? null, isTrustedUrl },
  )
  createWindow()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  void app.whenReady().then(start)
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    db?.close()
    db = null
  })
}
