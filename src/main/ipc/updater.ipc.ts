import { BrowserWindow, type IpcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '../../shared/ipc-channels'

export function registerUpdaterHandlers(ipcMain: IpcMain): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const sendStatus = (status: string, info?: unknown) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send(IPC.UPDATER_STATUS, { status, info })
  }

  autoUpdater.on('checking-for-update', () => sendStatus('checking'))
  autoUpdater.on('update-available', (info) => sendStatus('available', info))
  autoUpdater.on('update-not-available', () => sendStatus('not-available'))
  autoUpdater.on('download-progress', (progress) => sendStatus('downloading', progress))
  autoUpdater.on('update-downloaded', (info) => sendStatus('downloaded', info))
  autoUpdater.on('error', (err) => sendStatus('error', err.message))

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.UPDATER_INSTALL, () => {
    autoUpdater.quitAndInstall(false, true)
  })
}
