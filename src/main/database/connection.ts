import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { runMigrations } from './schema'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'accounting.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}
