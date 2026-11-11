import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import { resetDemoAccountPasswords } from './demoAccounts.js'

export function resetLocalDemoAccounts(
  dbPath = process.env.WORKHELP_DB_PATH ?? path.join('server', 'data', 'workhelp.sqlite'),
) {
  const resolvedPath = path.resolve(dbPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`WorkHelp database not found at "${resolvedPath}". Start the API once before resetting demo accounts.`)
  }

  const db = new Database(resolvedPath)
  try {
    return resetDemoAccountPasswords(db)
  } finally {
    db.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const accounts = resetLocalDemoAccounts()
    console.log(`Reset local demo passwords for: ${accounts.join(', ')}`)
    console.log('Existing tickets were not changed. All sessions for these accounts were signed out.')
  } catch (error) {
    console.error('Unable to reset local demo accounts:', error.message)
    process.exitCode = 1
  }
}
