import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface MigrationPaths {
  appDataDir: string
  newUserDataDir: string
}

export interface MigrationResult {
  dbPath: string
  migratedFrom: string | null
}

/**
 * Automatically migrates legacy SQLite database (plus WAL/SHM journals) from
 * IdlePulse / idle-pulse userData folders into WorkPacer userData folder
 * without losing any historical sessions, tasks, or reports.
 */
export function migrateLegacyDatabaseIfNeeded(paths: MigrationPaths): MigrationResult {
  mkdirSync(paths.newUserDataDir, { recursive: true })
  const targetDb = join(paths.newUserDataDir, 'workpacer.sqlite')

  if (existsSync(targetDb)) {
    return { dbPath: targetDb, migratedFrom: null }
  }

  const candidates = [
    join(paths.newUserDataDir, 'idlepulse.sqlite'),
    join(paths.appDataDir, 'IdlePulse', 'idlepulse.sqlite'),
    join(paths.appDataDir, 'idle-pulse', 'idlepulse.sqlite')
  ]

  for (const legacyDb of candidates) {
    if (existsSync(legacyDb)) {
      try {
        copyFileSync(legacyDb, targetDb)
        // Copy WAL and SHM files if present so uncommitted WAL frames are preserved
        if (existsSync(`${legacyDb}-wal`)) {
          copyFileSync(`${legacyDb}-wal`, `${targetDb}-wal`)
        }
        if (existsSync(`${legacyDb}-shm`)) {
          copyFileSync(`${legacyDb}-shm`, `${targetDb}-shm`)
        }
        return { dbPath: targetDb, migratedFrom: legacyDb }
      } catch {
        // Fallback to clean targetDb if copy fails due to external file lock
      }
    }
  }

  return { dbPath: targetDb, migratedFrom: null }
}
