import Database from 'better-sqlite3'
import { IPC } from '../../shared/ipc-channels'

export function registerSettingsHandlers(ipcMain: Electron.IpcMain, db: Database.Database): void {
  ipcMain.handle(IPC.SETTINGS_GET, (_e, key: string) => {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_e, key: string, value: string) => {
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
    return true
  })

  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    const rows = db.prepare('SELECT * FROM app_settings').all() as { key: string; value: string }[]
    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return settings
  })
}
