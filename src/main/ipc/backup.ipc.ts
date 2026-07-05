import Database from 'better-sqlite3'
import { app, dialog } from 'electron'
import { join } from 'path'
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { IPC } from '../../shared/ipc-channels'

export function registerBackupHandlers(ipcMain: Electron.IpcMain, db: Database.Database): void {
  const backupDir = join(app.getPath('userData'), 'backups')

  ipcMain.handle(IPC.BACKUP_CREATE, () => {
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    const backupPath = join(backupDir, `backup_${timestamp}.db`)

    db.pragma('wal_checkpoint(FULL)')

    const dbPath = join(app.getPath('userData'), 'accounting.db')
    copyFileSync(dbPath, backupPath)

    return { success: true, path: backupPath, name: `backup_${timestamp}.db` }
  })

  ipcMain.handle(IPC.BACKUP_RESTORE, async (_e, backupPath: string) => {
    if (!existsSync(backupPath)) {
      return { success: false, error: 'ملف النسخة الاحتياطية غير موجود' }
    }

    const dbPath = join(app.getPath('userData'), 'accounting.db')

    db.close()

    copyFileSync(backupPath, dbPath)

    return { success: true, needsRestart: true }
  })

  ipcMain.handle(IPC.BACKUP_LIST, () => {
    if (!existsSync(backupDir)) return []

    return readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const fullPath = join(backupDir, f)
        const stat = statSync(fullPath)
        return {
          name: f,
          path: fullPath,
          size: stat.size,
          date: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  })
}
