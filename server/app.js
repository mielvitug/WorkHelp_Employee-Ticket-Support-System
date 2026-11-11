import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import Database from 'better-sqlite3'
import express from 'express'
import { employeeUser, mockTickets, supportUser } from '../src/data/mockData.js'
import { demoAccounts } from '../src/data/demoCredentials.js'

const categories = new Set(['hardware', 'software', 'network', 'access', 'other'])
const priorities = new Set(['low', 'medium', 'high', 'urgent'])
const statuses = new Set(['open', 'in_progress', 'resolved', 'closed'])
const sessionCookieName = 'workhelp.sid'
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
const maxMessageLength = 2000
const minPasswordLength = 12
const maxPasswordLength = 35
const ticketColumns = `
  id, title, description, status, priority, category,
  requester_id, requester_name, requester_email,
  assignee_id, assignee_name, created_at, updated_at, resolved_at
`

function mapTicket(row) {
  return row ? {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    category: row.category,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  } : null
}

function validateTicket(ticket) {
  return ticket &&
    typeof ticket.id === 'string' &&
    /^t-\d+$/.test(ticket.id) &&
    typeof ticket.title === 'string' &&
    ticket.title.trim().length > 0 &&
    ticket.title.length <= 120 &&
    typeof ticket.description === 'string' &&
    ticket.description.trim().length > 0 &&
    ticket.description.length <= 2000 &&
    statuses.has(ticket.status) &&
    priorities.has(ticket.priority) &&
    categories.has(ticket.category) &&
    typeof ticket.requesterId === 'string' &&
    typeof ticket.requesterName === 'string' &&
    typeof ticket.requesterEmail === 'string' &&
    (ticket.assigneeId === null || typeof ticket.assigneeId === 'string') &&
    (ticket.assigneeName === null || typeof ticket.assigneeName === 'string') &&
    typeof ticket.createdAt === 'string' &&
    !Number.isNaN(Date.parse(ticket.createdAt)) &&
    typeof ticket.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(ticket.updatedAt)) &&
    (ticket.resolvedAt === null ||
      (typeof ticket.resolvedAt === 'string' && !Number.isNaN(Date.parse(ticket.resolvedAt))))
}

function insertTicket(db, ticket) {
  db.prepare(`
    INSERT INTO tickets (
      id, title, description, status, priority, category,
      requester_id, requester_name, requester_email,
      assignee_id, assignee_name, created_at, updated_at, resolved_at
    ) VALUES (
      @id, @title, @description, @status, @priority, @category,
      @requesterId, @requesterName, @requesterEmail,
      @assigneeId, @assigneeName, @createdAt, @updatedAt, @resolvedAt
    )
  `).run(ticket)
}

function nextTicketId(db) {
  let number = db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(id, 3) AS INTEGER)), 0) + 1 AS nextNumber
    FROM tickets
    WHERE id GLOB 't-[0-9]*'
  `).get().nextNumber

  while (db.prepare('SELECT 1 FROM tickets WHERE id = ?').get(`t-${number}`)) {
    number += 1
  }

  return `t-${number}`
}

function hashPassword(password, salt = randomBytes(16)) {
  return {
    salt: salt.toString('hex'),
    hash: scryptSync(password, salt, 64).toString('hex'),
  }
}

function seedUsers(db, credentials) {
  const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
  if (users > 0) return

  const isProduction = process.env.NODE_ENV === 'production'
  const employeePassword = credentials?.employeePassword ??
    process.env.WORKHELP_EMPLOYEE_PASSWORD ??
    (isProduction ? undefined : demoAccounts.employee.password)
  const supportPassword = credentials?.supportPassword ??
    process.env.WORKHELP_SUPPORT_PASSWORD ??
    (isProduction ? undefined : demoAccounts.support.password)
  const passwordErrors = []
  for (const [name, password] of [
    ['WORKHELP_EMPLOYEE_PASSWORD', employeePassword],
    ['WORKHELP_SUPPORT_PASSWORD', supportPassword],
  ]) {
    if (typeof password !== 'string' || password.length === 0) {
      passwordErrors.push(`${name} is not set.`)
    } else if (password.length < 12) {
      passwordErrors.push(`${name} is too short (${password.length} characters; at least 12 required).`)
    } else if (password.length > 200) {
      passwordErrors.push(`${name} is too long (${password.length} characters; maximum 200).`)
    }
  }

  if (passwordErrors.length > 0) {
    throw new Error(`Cannot initialize WorkHelp accounts. ${passwordErrors.join(' ')}`)
  }

  const seededUsers = [
    { ...employeeUser, password: employeePassword },
    { ...supportUser, password: supportPassword },
  ]
  const insert = db.prepare(`
    INSERT INTO users (id, name, email, role, password_salt, password_hash)
    VALUES (@id, @name, @email, @role, @salt, @hash)
  `)
  db.transaction(() => {
    for (const user of seededUsers) {
      const { salt, hash } = hashPassword(user.password)
      insert.run({
        id: user.id,
        name: user.name,
        email: user.email.toLowerCase(),
        role: user.role,
        salt,
        hash,
      })
    }
  })()
}

function initializeDatabase(db, credentials) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
      description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 2000),
      status TEXT NOT NULL CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      category TEXT NOT NULL CHECK(category IN ('hardware', 'software', 'network', 'access', 'other')),
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      assignee_id TEXT,
      assignee_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('employee', 'support')),
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_imports (
      migration_id TEXT NOT NULL,
      original_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      PRIMARY KEY (migration_id, original_id)
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      author_id TEXT NOT NULL REFERENCES users(id),
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL CHECK(author_role IN ('employee', 'support')),
      content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND ${maxMessageLength}),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ticket_messages_ticket_id_id
      ON ticket_messages(ticket_id, id);
  `)

  const count = db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count
  if (count === 0) {
    const seed = db.transaction(() => {
      for (const ticket of mockTickets) {
        insertTicket(db, ticket)
      }
    })
    seed()
  }
  seedUsers(db, credentials)
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readCookie(request, name) {
  const cookies = request.headers.cookie?.split(';') ?? []
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=')
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

function setSessionCookie(response, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`,
  )
}

function createSession(db, response, user) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = Date.now() + sessionDurationMs
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashSessionToken(token), user.id, expiresAt)
  setSessionCookie(response, token, sessionDurationMs / 1000)
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
  )
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

function createAuthentication(db) {
  const authenticate = (request, response, next) => {
    const token = readCookie(request, sessionCookieName)
    if (!token) {
      return response.status(401).json({ error: 'Sign in is required.' })
    }

    const session = db.prepare(`
      SELECT users.id, users.name, users.email, users.role, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `).get(hashSessionToken(token))
    if (!session || session.expires_at <= Date.now()) {
      if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token))
      clearSessionCookie(response)
      return response.status(401).json({ error: 'Your session has expired. Sign in again.' })
    }

    request.user = publicUser(session)
    request.sessionTokenHash = hashSessionToken(token)
    return next()
  }

  const requireRole = (...roles) => (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'You do not have permission to perform this action.' })
    }
    return next()
  }

  return { authenticate, requireRole }
}

export function createApp(
  dbPath = process.env.WORKHELP_DB_PATH ?? path.join('server', 'data', 'workhelp.sqlite'),
  options = {},
) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  try {
    initializeDatabase(db, options.seedCredentials)
  } catch (error) {
    db.close()
    throw error
  }

  const app = express()
  app.locals.db = db
  app.use(express.json({ limit: '2mb' }))
  const { authenticate, requireRole } = createAuthentication(db)

  app.get('/api/auth/session', (request, response) => {
    const token = readCookie(request, sessionCookieName)
    if (!token) return response.json({ user: null })

    const session = db.prepare(`
      SELECT users.id, users.name, users.email, users.role, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
    `).get(hashSessionToken(token))
    if (!session || session.expires_at <= Date.now()) {
      if (session) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token))
      clearSessionCookie(response)
      return response.json({ user: null })
    }
    return response.json({ user: publicUser(session) })
  })

  const loginAttempts = new Map()
  const registrationAttempts = new Map()
  app.post('/api/auth/register', (request, response) => {
    const now = Date.now()
    const address = request.ip
    const attempts = registrationAttempts.get(address)
    if (attempts && attempts.resetAt > now && attempts.count >= 8) {
      return response.status(429).json({ error: 'Too many registration attempts. Try again in 15 minutes.' })
    }

    const nextAttempts = !attempts || attempts.resetAt <= now
      ? { count: 1, resetAt: now + 15 * 60 * 1000 }
      : { ...attempts, count: attempts.count + 1 }
    registrationAttempts.set(address, nextAttempts)

    const { name, email, password } = request.body ?? {}
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (
      !normalizedName ||
      normalizedName.length > 80 ||
      normalizedName.includes('\0') ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
      typeof password !== 'string' ||
      password.length < minPasswordLength ||
      password.length > maxPasswordLength
    ) {
      return response.status(400).json({
        error: `Enter a name, valid email address, and password between ${minPasswordLength} and ${maxPasswordLength} characters.`,
      })
    }

    const user = {
      id: `u-${randomUUID()}`,
      name: normalizedName,
      email: normalizedEmail,
      role: 'employee',
    }
    const { salt, hash } = hashPassword(password)
    const sessionToken = randomBytes(32).toString('base64url')
    const expiresAt = now + sessionDurationMs
    const createUserAndSession = db.transaction(() => {
      const result = db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, role, password_salt, password_hash)
        VALUES (?, ?, ?, 'employee', ?, ?)
      `).run(user.id, user.name, user.email, salt, hash)
      if (result.changes === 0) return false

      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
      db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(hashSessionToken(sessionToken), user.id, expiresAt)
      return true
    })
    if (!createUserAndSession()) {
      return response.status(409).json({ error: 'An account with this email already exists.' })
    }

    setSessionCookie(response, sessionToken, sessionDurationMs / 1000)
    return response.status(201).json({ user: publicUser(user) })
  })

  app.post('/api/auth/login', (request, response) => {
    const now = Date.now()
    const address = request.ip
    const attempts = loginAttempts.get(address)
    if (attempts && attempts.resetAt > now && attempts.count >= 10) {
      return response.status(429).json({ error: 'Too many sign-in attempts. Try again in 15 minutes.' })
    }

    const { email, password } = request.body ?? {}
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) {
      return response.status(400).json({ error: 'Enter a valid email address and password.' })
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase())
    const salt = user ? Buffer.from(user.password_salt, 'hex') : Buffer.alloc(16)
    const expectedHash = user ? Buffer.from(user.password_hash, 'hex') : Buffer.alloc(64)
    const actualHash = scryptSync(password, salt, 64)
    if (!user || !timingSafeEqual(expectedHash, actualHash)) {
      const nextAttempts = !attempts || attempts.resetAt <= now
        ? { count: 1, resetAt: now + 15 * 60 * 1000 }
        : { ...attempts, count: attempts.count + 1 }
      loginAttempts.set(address, nextAttempts)
      return response.status(401).json({ error: 'Email or password is incorrect.' })
    }

    loginAttempts.delete(address)
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
    createSession(db, response, user)
    return response.json({ user: publicUser(user) })
  })

  app.patch('/api/auth/password', authenticate, (request, response) => {
    const { currentPassword, newPassword } = request.body ?? {}
    if (
      typeof currentPassword !== 'string' ||
      currentPassword.length === 0 ||
      currentPassword.length > 200 ||
      typeof newPassword !== 'string' ||
      newPassword.length < minPasswordLength ||
      newPassword.length > maxPasswordLength
    ) {
      return response.status(400).json({
        error: `Enter your current password and a new password between ${minPasswordLength} and ${maxPasswordLength} characters.`,
      })
    }

    const account = db.prepare(`
      SELECT password_salt, password_hash FROM users WHERE id = ?
    `).get(request.user.id)
    if (!account) {
      return response.status(401).json({ error: 'Your account could not be verified. Sign in again.' })
    }

    const salt = Buffer.from(account.password_salt, 'hex')
    const expectedHash = Buffer.from(account.password_hash, 'hex')
    const currentHash = scryptSync(currentPassword, salt, 64)
    if (!timingSafeEqual(expectedHash, currentHash)) {
      return response.status(400).json({ error: 'Your current password is incorrect.' })
    }
    if (timingSafeEqual(currentHash, scryptSync(newPassword, salt, 64))) {
      return response.status(400).json({ error: 'Choose a new password that differs from your current password.' })
    }

    const updatedPassword = hashPassword(newPassword)
    const changePassword = db.transaction(() => {
      db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?')
        .run(updatedPassword.salt, updatedPassword.hash, request.user.id)
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
        .run(request.user.id, request.sessionTokenHash)
    })
    changePassword()

    return response.json({ user: request.user })
  })

  app.post('/api/auth/logout', (request, response) => {
    const token = readCookie(request, sessionCookieName)
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token))
    clearSessionCookie(response)
    return response.status(204).end()
  })

  app.use('/api/tickets', authenticate)
  app.use('/api/tickets/import', requireRole('employee'))

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.get('/api/tickets', (request, response) => {
    const rows = request.user.role === 'support'
      ? db.prepare(`SELECT ${ticketColumns} FROM tickets ORDER BY created_at DESC, id DESC`).all()
      : db.prepare(`SELECT ${ticketColumns} FROM tickets WHERE requester_id = ? ORDER BY created_at DESC, id DESC`)
        .all(request.user.id)
    const tickets = rows
      .map(mapTicket)
    response.json(tickets)
  })

  app.get('/api/tickets/:ticketId', (request, response) => {
    const ticket = mapTicket(db.prepare(`
      SELECT ${ticketColumns} FROM tickets
      WHERE id = ? AND (? = 'support' OR requester_id = ?)
    `).get(request.params.ticketId, request.user.role, request.user.id))
    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found.' })
    }

    return response.json(ticket)
  })

  app.get('/api/tickets/:ticketId/messages', (request, response) => {
    const ticket = db.prepare(`
      SELECT id FROM tickets
      WHERE id = ? AND (? = 'support' OR requester_id = ?)
    `).get(request.params.ticketId, request.user.role, request.user.id)
    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found.' })
    }

    const messages = db.prepare(`
      SELECT id, author_id, author_name, author_role, content, created_at
      FROM ticket_messages
      WHERE ticket_id = ?
      ORDER BY id ASC
    `).all(ticket.id)
      .map((message) => ({
        id: message.id,
        authorId: message.author_id,
        authorName: message.author_name,
        authorRole: message.author_role,
        content: message.content,
        createdAt: message.created_at,
      }))
    return response.json(messages)
  })

  app.post('/api/tickets/:ticketId/messages', (request, response) => {
    const ticket = db.prepare(`
      SELECT id FROM tickets
      WHERE id = ? AND (? = 'support' OR requester_id = ?)
    `).get(request.params.ticketId, request.user.role, request.user.id)
    if (!ticket) {
      return response.status(404).json({ error: 'Ticket not found.' })
    }

    const { content } = request.body ?? {}
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      content.trim().length > maxMessageLength
    ) {
      return response.status(400).json({
        error: `Reply must contain 1 to ${maxMessageLength} characters.`,
      })
    }

    const createdAt = new Date().toISOString()
    const insertMessage = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO ticket_messages (
          ticket_id, author_id, author_name, author_role, content, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        ticket.id,
        request.user.id,
        request.user.name,
        request.user.role,
        content.trim(),
        createdAt,
      )
      db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?')
        .run(createdAt, ticket.id)
      return Number(result.lastInsertRowid)
    })
    const messageId = insertMessage()

    return response.status(201).json({
      id: messageId,
      authorId: request.user.id,
      authorName: request.user.name,
      authorRole: request.user.role,
      content: content.trim(),
      createdAt,
    })
  })

  app.post('/api/tickets/import', (request, response) => {
    const { tickets, migrationId } = request.body ?? {}
    if (
      typeof migrationId !== 'string' || migrationId.length < 1 || migrationId.length > 100 ||
      !Array.isArray(tickets) || tickets.length > 1000 || !tickets.every(validateTicket) ||
      new Set(tickets.map(({ id }) => id)).size !== tickets.length
    ) {
      return response.status(400).json({ error: 'Ticket import must contain at most 1000 valid tickets.' })
    }

    const importTickets = db.transaction(({ incomingTickets, sourceMigrationId }) => {
      let imported = 0
      let unchanged = 0
      const importedIds = []

      for (const incoming of incomingTickets) {
        const previousImport = db.prepare(`
          SELECT ticket_id FROM legacy_imports WHERE migration_id = ? AND original_id = ?
        `).get(sourceMigrationId, incoming.id)
        if (previousImport) {
          unchanged += 1
          importedIds.push({ originalId: incoming.id, id: previousImport.ticket_id })
          continue
        }

        const ownedTicket = {
          ...incoming,
          requesterId: request.user.id,
          requesterName: request.user.name,
          requesterEmail: request.user.email,
        }
        const existing = mapTicket(db.prepare(`SELECT ${ticketColumns} FROM tickets WHERE id = ?`).get(incoming.id))
        if (existing && Object.keys(ownedTicket).every((key) => existing[key] === ownedTicket[key])) {
          db.prepare('INSERT INTO legacy_imports (migration_id, original_id, ticket_id) VALUES (?, ?, ?)')
            .run(sourceMigrationId, incoming.id, existing.id)
          unchanged += 1
          importedIds.push({ originalId: incoming.id, id: existing.id })
          continue
        }

        const ticket = {
          ...ownedTicket,
          id: existing ? nextTicketId(db) : incoming.id,
        }
        insertTicket(db, ticket)
        db.prepare('INSERT INTO legacy_imports (migration_id, original_id, ticket_id) VALUES (?, ?, ?)')
          .run(sourceMigrationId, incoming.id, ticket.id)
        imported += 1
        importedIds.push({ originalId: incoming.id, id: ticket.id })
      }

      return { imported, unchanged, importedIds }
    })

    return response.json(importTickets({ incomingTickets: tickets, sourceMigrationId: migrationId }))
  })

  app.post('/api/tickets', (request, response) => {
    if (request.user.role !== 'employee') {
      return response.status(403).json({ error: 'Only employee users may create tickets.' })
    }

    const { title, description, category, priority } = request.body ?? {}
    if (
      typeof title !== 'string' || !title.trim() || title.length > 120 ||
      typeof description !== 'string' || !description.trim() || description.length > 2000 ||
      !categories.has(category) || !priorities.has(priority)
    ) {
      return response.status(400).json({ error: 'Enter a title and description, and choose a valid category and priority.' })
    }

    const now = new Date().toISOString()
    const ticket = {
      id: nextTicketId(db),
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      priority,
      category,
      requesterId: request.user.id,
      requesterName: request.user.name,
      requesterEmail: request.user.email,
      assigneeId: null,
      assigneeName: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    }

    insertTicket(db, ticket)
    return response.status(201).json(ticket)
  })

  app.patch('/api/tickets/:ticketId/status', (request, response) => {
    if (request.user.role !== 'support') {
      return response.status(403).json({ error: 'Only support users may update ticket status.' })
    }
    const { status } = request.body ?? {}
    if (!statuses.has(status)) {
      return response.status(400).json({ error: 'Choose a valid ticket status.' })
    }

    const existing = mapTicket(db.prepare(`SELECT ${ticketColumns} FROM tickets WHERE id = ?`).get(request.params.ticketId))
    if (!existing) {
      return response.status(404).json({ error: 'Ticket not found.' })
    }

    if (existing.status === status) {
      return response.json(existing)
    }

    const now = new Date().toISOString()
    const resolvedAt = status === 'resolved' || status === 'closed'
      ? existing.resolvedAt ?? now
      : null
    db.prepare('UPDATE tickets SET status = ?, updated_at = ?, resolved_at = ? WHERE id = ?')
      .run(status, now, resolvedAt, request.params.ticketId)

    return response.json(mapTicket(db.prepare(`SELECT ${ticketColumns} FROM tickets WHERE id = ?`).get(request.params.ticketId)))
  })

  app.patch('/api/tickets/:ticketId/assignee', (request, response) => {
    if (request.user.role !== 'support') {
      return response.status(403).json({ error: 'Only support users may update ticket assignments.' })
    }

    const body = request.body ?? {}
    if (typeof body.assigned !== 'boolean' || Object.hasOwn(body, 'assigneeId')) {
      return response.status(400).json({ error: 'Choose whether to assign this ticket to yourself.' })
    }

    const existing = mapTicket(db.prepare(`
      SELECT ${ticketColumns} FROM tickets WHERE id = ?
    `).get(request.params.ticketId))
    if (!existing) {
      return response.status(404).json({ error: 'Ticket not found.' })
    }

    const assigneeId = body.assigned ? request.user.id : null
    const assigneeName = body.assigned ? request.user.name : null
    if (existing.assigneeId === assigneeId && existing.assigneeName === assigneeName) {
      return response.json(existing)
    }

    const updatedAt = new Date().toISOString()
    db.prepare(`
      UPDATE tickets
      SET assignee_id = ?, assignee_name = ?, updated_at = ?
      WHERE id = ?
    `).run(assigneeId, assigneeName, updatedAt, request.params.ticketId)

    return response.json(mapTicket(db.prepare(`
      SELECT ${ticketColumns} FROM tickets WHERE id = ?
    `).get(request.params.ticketId)))
  })

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' })
    }
    console.error(error)
    return response.status(500).json({ error: 'An unexpected server error occurred.' })
  })

  return app
}
