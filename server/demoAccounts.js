import { randomBytes, scryptSync } from 'node:crypto'
import { demoAccounts } from '../src/data/demoCredentials.js'
import { employeeUser, supportUser } from '../src/data/mockData.js'

export function resetDemoAccountPasswords(db) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo account password reset is disabled in production.')
  }

  const accounts = [
    { user: employeeUser, account: demoAccounts.employee },
    { user: supportUser, account: demoAccounts.support },
  ]

  const storedAccounts = accounts.map(({ user }) =>
    db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(user.id),
  )

  for (const [index, stored] of storedAccounts.entries()) {
    const { user, account } = accounts[index]
    if (
      !stored ||
      stored.email !== account.email ||
      stored.role !== user.role
    ) {
      throw new Error(`Cannot reset demo password: expected seeded ${user.role} account was not found.`)
    }
  }

  const updatePassword = db.prepare(`
    UPDATE users SET password_salt = ?, password_hash = ?
    WHERE id = ? AND email = ? AND role = ?
  `)
  const deleteSessions = db.prepare(
    'DELETE FROM sessions WHERE user_id IN (?, ?)',
  )

  db.transaction(() => {
    for (const { user, account } of accounts) {
      const salt = randomBytes(16)
      updatePassword.run(
        salt.toString('hex'),
        scryptSync(account.password, salt, 64).toString('hex'),
        user.id,
        account.email,
        user.role,
      )
    }
    deleteSessions.run(employeeUser.id, supportUser.id)
  })()

  return accounts.map(({ account }) => account.email)
}
