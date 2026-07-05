import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { initDatabase } from './database/connection'
import { registerDatabaseHandlers } from './ipc/database.ipc'
import { registerSettingsHandlers } from './ipc/settings.ipc'
import { registerAIHandlers } from './ipc/ai.ipc'
import { registerBackupHandlers } from './ipc/backup.ipc'
import { registerPDFHandlers } from './ipc/pdf.ipc'
import { registerUpdaterHandlers } from './ipc/updater.ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'المحاسب الذكي',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })

  const db = initDatabase()

  registerDatabaseHandlers(ipcMain, db)
  registerSettingsHandlers(ipcMain, db)
  registerAIHandlers(ipcMain, db)
  registerBackupHandlers(ipcMain, db)
  registerPDFHandlers()
  registerUpdaterHandlers(ipcMain)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
