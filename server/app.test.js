import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createApp } from './app.js'
import { demoAccounts } from '../src/data/demoCredentials.js'
import { resetDemoAccountPasswords } from './demoAccounts.js'

test('reports which initial account password is too short without exposing it', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-password-check-'))
  const employeePassword = 'eight888'
  const supportPassword = 'tenletters'

  try {
    assert.throws(
      () => createApp(path.join(directory, 'tickets.sqlite'), {
        seedCredentials: { employeePassword, supportPassword },
      }),
      (error) => {
        assert.match(error.message, /WORKHELP_EMPLOYEE_PASSWORD is too short \(8 characters; at least 12 required\)/)
        assert.match(error.message, /WORKHELP_SUPPORT_PASSWORD is too short \(10 characters; at least 12 required\)/)
        assert.equal(error.message.includes(employeePassword), false)
        assert.equal(error.message.includes(supportPassword), false)
        return true
      },
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

async function withApi(run, { seedCredentials = credentials } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-api-'))
  const testCredentials = {
    employeePassword: 'employee-test-password',
    supportPassword: 'support-test-password',
  }
  const app = createApp(
    path.join(directory, 'tickets.sqlite'),
    seedCredentials ? { seedCredentials } : {},
  )
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const login = async (email, password) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return { response, cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  const employee = await login('mia.santos@example.com', testCredentials.employeePassword)
  const request = (url, options = {}, cookie = employee.cookie) => fetch(`${baseUrl}${url}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(cookie ? { cookie } : {}),
    },
  })

  try {
    await run({
      baseUrl,
      login,
      request,
      employeeCookie: employee.cookie,
      db: app.locals.db,
      testCredentials,
    })
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    app.locals.db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

async function withEnvironment(values, run) {
  const original = Object.fromEntries(
    Object.keys(values).map((name) => [name, process.env[name]]),
  )
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  try {
    return await run()
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

const credentials = {
  employeePassword: 'employee-test-password',
  supportPassword: 'support-test-password',
}

test('seeds local demo sign-ins when credentials are not configured', async () => {
  await withEnvironment({
    NODE_ENV: 'development',
    WORKHELP_EMPLOYEE_PASSWORD: undefined,
    WORKHELP_SUPPORT_PASSWORD: undefined,
  }, async () => {
    await withApi(async ({ login }) => {
      const employee = await login(demoAccounts.employee.email, demoAccounts.employee.password)
      const support = await login(demoAccounts.support.email, demoAccounts.support.password)

      assert.equal(employee.response.status, 200)
      assert.equal((await employee.response.json()).user.role, 'employee')
      assert.equal(support.response.status, 200)
      assert.equal((await support.response.json()).user.role, 'support')
    }, { seedCredentials: null })
  })
})

test('requires explicit account passwords in production', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-production-seed-'))
  await withEnvironment({
    NODE_ENV: 'production',
    WORKHELP_EMPLOYEE_PASSWORD: undefined,
    WORKHELP_SUPPORT_PASSWORD: undefined,
  }, async () => {
    try {
      assert.throws(
        () => createApp(path.join(directory, 'tickets.sqlite')),
        /WORKHELP_EMPLOYEE_PASSWORD is not set/,
      )
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})

test('does not replace account passwords in an existing database', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-existing-users-'))
  const dbPath = path.join(directory, 'tickets.sqlite')
  let initialApp
  let reopenedApp

  await withEnvironment({
    NODE_ENV: 'development',
    WORKHELP_EMPLOYEE_PASSWORD: undefined,
    WORKHELP_SUPPORT_PASSWORD: undefined,
  }, async () => {
    try {
      initialApp = createApp(dbPath, {
        seedCredentials: {
          employeePassword: 'original-employee-password',
          supportPassword: 'original-support-password',
        },
      })
      const originalHash = initialApp.locals.db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get('u-1').password_hash
      initialApp.locals.db.close()
      initialApp = null

      reopenedApp = createApp(dbPath)
      const currentHash = reopenedApp.locals.db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get('u-1').password_hash
      assert.equal(currentHash, originalHash)
    } finally {
      initialApp?.locals.db.close()
      reopenedApp?.locals.db.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})

test('adds the conversation table when opening an existing database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-message-migration-'))
  const dbPath = path.join(directory, 'tickets.sqlite')
  let initialApp
  let reopenedApp

  try {
    initialApp = createApp(dbPath, { seedCredentials: credentials })
    initialApp.locals.db.exec('DROP TABLE ticket_messages')
    initialApp.locals.db.close()
    initialApp = null

    reopenedApp = createApp(dbPath, { seedCredentials: credentials })
    const table = reopenedApp.locals.db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ticket_messages'
    `).get()
    assert.ok(table)
    assert.equal(reopenedApp.locals.db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count, 6)
  } finally {
    initialApp?.locals.db.close()
    reopenedApp?.locals.db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('resets only local demo account passwords and revokes their sessions', async () => {
  await withApi(async ({ db }) => {
    const employeeHashBefore = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get('u-1').password_hash
    const supportHashBefore = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get('u-2').password_hash
    const ticketCountBefore = db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run('employee-session-test', 'u-1', Date.now() + 60_000)
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run('support-session-test', 'u-2', Date.now() + 60_000)

    assert.deepEqual(resetDemoAccountPasswords(db), [
      demoAccounts.employee.email,
      demoAccounts.support.email,
    ])
    assert.notEqual(
      db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u-1').password_hash,
      employeeHashBefore,
    )
    assert.notEqual(
      db.prepare('SELECT password_hash FROM users WHERE id = ?').get('u-2').password_hash,
      supportHashBefore,
    )
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count, 0)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count, ticketCountBefore)
  })
})

test('refuses to reset demo account passwords in production', async () => {
  await withApi(async ({ db }) => {
    await withEnvironment({ NODE_ENV: 'production' }, async () => {
      assert.throws(
        () => resetDemoAccountPasswords(db),
        /Demo account password reset is disabled in production/,
      )
    })
  })
})

test('seeds tickets and supports creation, lookup, and status updates', async () => {
  await withApi(async ({ request, login }) => {
    const initialResponse = await request('/api/tickets')
    const initialTickets = await initialResponse.json()
    assert.equal(initialResponse.status, 200)
    assert.equal(initialTickets.length, 6)

    const createResponse = await request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Monitor flicker',
        description: 'Screen flickers after startup.',
        category: 'hardware',
        priority: 'high',
      }),
    })
    const created = await createResponse.json()
    assert.equal(createResponse.status, 201)
    assert.equal(created.id, 't-7')
    assert.equal(created.requesterId, 'u-1')

    const lookupResponse = await request(`/api/tickets/${created.id}`)
    assert.equal((await lookupResponse.json()).title, 'Monitor flicker')

    const unauthorizedStatus = await request(`/api/tickets/${created.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    })
    assert.equal(unauthorizedStatus.status, 403)

    const support = await login('alex.cruz@example.com', 'support-test-password')
    const statusResponse = await request(`/api/tickets/${created.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    }, support.cookie)
    const resolved = await statusResponse.json()
    assert.equal(resolved.status, 'resolved')
    assert.ok(resolved.resolvedAt)
    assert.ok(resolved.updatedAt)
  })
})

test('stores ordered ticket replies with session-derived authors and enforces ticket access', async () => {
  await withApi(async ({ baseUrl, login, request, db }) => {
    const initialTicket = db.prepare('SELECT status, resolved_at FROM tickets WHERE id = ?').get('t-1')
    const emptyResponse = await request('/api/tickets/t-1/messages')
    assert.equal(emptyResponse.status, 200)
    assert.deepEqual(await emptyResponse.json(), [])

    const emptyReply = await request('/api/tickets/t-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '   ' }),
    })
    assert.equal(emptyReply.status, 400)

    const oversizedReply = await request('/api/tickets/t-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'x'.repeat(2001) }),
    })
    assert.equal(oversizedReply.status, 400)

    const employeeReply = await request('/api/tickets/t-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: '  I can provide another detail.  ',
        authorId: 'u-2',
        authorName: 'Forged support user',
        authorRole: 'support',
      }),
    })
    const firstMessage = await employeeReply.json()
    assert.equal(employeeReply.status, 201)
    assert.equal(firstMessage.content, 'I can provide another detail.')
    assert.equal(firstMessage.authorId, 'u-1')
    assert.equal(firstMessage.authorName, 'Mia Santos')
    assert.equal(firstMessage.authorRole, 'employee')
    assert.ok(!Number.isNaN(Date.parse(firstMessage.createdAt)))

    const foreignTicket = db.prepare(`
      SELECT id FROM tickets WHERE id = ?
    `).get('t-6')
    db.prepare('UPDATE tickets SET requester_id = ? WHERE id = ?').run('someone-else', foreignTicket.id)
    const forbiddenRead = await request('/api/tickets/t-6/messages')
    const forbiddenPost = await request('/api/tickets/t-6/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'This should not be visible.' }),
    })
    assert.equal(forbiddenRead.status, 404)
    assert.equal(forbiddenPost.status, 404)

    const support = await login('alex.cruz@example.com', 'support-test-password')
    const supportReply = await request('/api/tickets/t-1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'We will look into this.' }),
    }, support.cookie)
    const secondMessage = await supportReply.json()
    assert.equal(supportReply.status, 201)
    assert.equal(secondMessage.authorId, 'u-2')
    assert.equal(secondMessage.authorRole, 'support')

    const closedReply = await request('/api/tickets/t-6/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'Following up on the resolved ticket.' }),
    }, support.cookie)
    assert.equal(closedReply.status, 201)
    assert.equal(db.prepare('SELECT status FROM tickets WHERE id = ?').get('t-6').status, 'closed')

    const listed = await request('/api/tickets/t-1/messages', {}, support.cookie)
    const messages = await listed.json()
    assert.deepEqual(messages.map(({ id }) => id), [firstMessage.id, secondMessage.id])
    assert.ok(messages[0].createdAt <= messages[1].createdAt)

    const updatedTicket = db.prepare('SELECT status, resolved_at, updated_at FROM tickets WHERE id = ?').get('t-1')
    assert.equal(updatedTicket.status, initialTicket.status)
    assert.equal(updatedTicket.resolved_at, initialTicket.resolved_at)
    assert.equal(updatedTicket.updated_at, secondMessage.createdAt)

    const anonymous = await fetch(`${baseUrl}/api/tickets/t-1/messages`)
    assert.equal(anonymous.status, 401)
  })
})

test('validates ticket requests and reports missing records', async () => {
  await withApi(async ({ request, login }) => {
    const invalid = await request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', description: 'Issue', category: 'other', priority: 'low' }),
    })
    assert.equal(invalid.status, 400)

    const missing = await request('/api/tickets/missing')
    assert.equal(missing.status, 404)

    const invalidStatus = await request('/api/tickets/t-1/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'not-a-status' }),
    }, (await login('alex.cruz@example.com', 'support-test-password')).cookie)
    assert.equal(invalidStatus.status, 400)
  })
})

test('imports local tickets idempotently and remaps conflicting IDs', async () => {
  await withApi(async ({ request }) => {
    const localTickets = await (await request('/api/tickets')).json()
    const migrationId = 'test-migration-id'
    localTickets[0].status = 'in_progress'
    const localOnly = {
      ...localTickets[0],
      id: 't-7',
      title: 'Locally created ticket',
      requesterId: 'u-2',
      requesterName: 'Alex Cruz',
      requesterEmail: 'alex.cruz@example.com',
    }

    const importResponse = await request('/api/tickets/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ migrationId, tickets: [...localTickets, localOnly] }),
    })
    const result = await importResponse.json()
    assert.equal(importResponse.status, 200)
    assert.equal(result.imported, 2)
    assert.equal(result.unchanged, 5)
    assert.equal(result.importedIds.find(({ originalId }) => originalId === 't-1').id, 't-7')
    assert.equal(result.importedIds.find(({ originalId }) => originalId === 't-7').id, 't-8')
    const importedTicket = await (await request('/api/tickets/t-8')).json()
    assert.equal(importedTicket.requesterId, 'u-1')

    const rerunResponse = await request('/api/tickets/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ migrationId, tickets: [...localTickets, localOnly] }),
    })
    const rerun = await rerunResponse.json()
    assert.equal(rerun.imported, 0)
    assert.equal(rerun.unchanged, 7)
  })
})

test('requires a valid session and returns user and role without password data', async () => {
  await withApi(async ({ baseUrl, login, request, db }) => {
    const anonymous = await fetch(`${baseUrl}/api/tickets`)
    assert.equal(anonymous.status, 401)

    const invalidLogin = await login('mia.santos@example.com', 'wrong-password')
    assert.equal(invalidLogin.response.status, 401)
    assert.deepEqual(await invalidLogin.response.json(), { error: 'Email or password is incorrect.' })

    const session = await fetch(`${baseUrl}/api/auth/session`, {
      headers: { cookie: (await login('mia.santos@example.com', 'employee-test-password')).cookie },
    })
    const sessionBody = await session.json()
    assert.equal(sessionBody.user.role, 'employee')
    assert.equal(sessionBody.user.email, 'mia.santos@example.com')
    assert.equal(Object.hasOwn(sessionBody.user, 'password_hash'), false)
    const storedEmployee = db.prepare('SELECT password_salt, password_hash FROM users WHERE id = ?').get('u-1')
    assert.notEqual(storedEmployee.password_hash, 'employee-test-password')
    assert.match(storedEmployee.password_salt, /^[a-f0-9]{32}$/)
    assert.match(storedEmployee.password_hash, /^[a-f0-9]{128}$/)

    const support = await login('alex.cruz@example.com', 'support-test-password')
    const allTickets = await request('/api/tickets', {}, support.cookie)
    assert.equal((await allTickets.json()).length, 6)
  })
})

test('registers employees only and normalizes unique email addresses', async () => {
  await withApi(async ({ baseUrl, db }) => {
    const register = (body) => fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    for (const body of [
      { name: 'New User', email: 'not-an-email', password: 'valid-password-123' },
      { name: ' ', email: 'new@example.com', password: 'valid-password-123' },
      { name: 'New User', email: 'new@example.com', password: 'short' },
      { name: 'New User', email: 'new@example.com', password: 'x'.repeat(36) },
    ]) {
      assert.equal((await register(body)).status, 400)
    }

    const response = await register({
      name: '  Jamie New  ',
      email: '  Jamie.New@Example.COM  ',
      password: 'N'.repeat(35),
      role: 'support',
    })
    const body = await response.json()
    assert.equal(response.status, 201)
    assert.match(response.headers.get('set-cookie'), /HttpOnly/)
    assert.deepEqual(body.user, {
      id: body.user.id,
      name: 'Jamie New',
      email: 'jamie.new@example.com',
      role: 'employee',
    })
    assert.match(body.user.id, /^u-[0-9a-f-]{36}$/)
    assert.equal(db.prepare('SELECT role FROM users WHERE email = ?')
      .get('jamie.new@example.com').role, 'employee')

    const duplicate = await register({
      name: 'Duplicate User',
      email: 'JAMIE.NEW@example.com',
      password: 'valid-password-123',
    })
    assert.equal(duplicate.status, 409)

    const seededDuplicate = await register({
      name: 'Existing Employee',
      email: 'MIA.SANTOS@EXAMPLE.COM',
      password: 'valid-password-123',
    })
    assert.equal(seededDuplicate.status, 409)

    const createdUserLogin = await fetch(`${baseUrl}/api/tickets`, {
      headers: { cookie: response.headers.get('set-cookie').split(';')[0] },
    })
    assert.equal(createdUserLogin.status, 200)
    assert.deepEqual(await createdUserLogin.json(), [])
    assert.equal(db.prepare('SELECT role FROM users WHERE id = ?').get('u-2').role, 'support')
  })
})

test('changes passwords after current-password verification and revokes other sessions', async () => {
  await withApi(async ({ baseUrl, login, request, db }) => {
    const firstSession = await login('mia.santos@example.com', 'employee-test-password')
    const secondSession = await login('mia.santos@example.com', 'employee-test-password')
    const change = (currentPassword, newPassword, cookie = firstSession.cookie) =>
      fetch(`${baseUrl}/api/auth/password`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

    assert.equal((await change('wrong-password', 'new-password-123')).status, 400)
    assert.equal((await change('employee-test-password', 'short')).status, 400)
    assert.equal((await change('employee-test-password', 'x'.repeat(36))).status, 400)
    assert.equal((await change('employee-test-password', 'employee-test-password')).status, 400)
    assert.equal((await change('employee-test-password', 'new-password-123', null)).status, 401)

    const updated = await change('employee-test-password', 'N'.repeat(35))
    assert.equal(updated.status, 200)
    assert.equal((await updated.json()).user.id, 'u-1')

    assert.equal((await request('/api/tickets', {}, firstSession.cookie)).status, 200)
    assert.equal((await request('/api/tickets', {}, secondSession.cookie)).status, 401)
    assert.equal((await login('mia.santos@example.com', 'employee-test-password')).response.status, 401)
    assert.equal((await login('mia.santos@example.com', 'N'.repeat(35))).response.status, 200)
    assert.equal((await login('alex.cruz@example.com', 'support-test-password')).response.status, 200)

    const employeeSessions = db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?')
      .get('u-1').count
    assert.equal(employeeSessions, 2)
  })
})

test('persists sessions across requests, expires them, and invalidates them on sign-out', async () => {
  await withApi(async ({ baseUrl, login, db }) => {
    const { response, cookie } = await login('mia.santos@example.com', 'employee-test-password')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('set-cookie'), /HttpOnly/)
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/)
    assert.match(response.headers.get('set-cookie'), /Max-Age=604800/)

    const active = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } })
    assert.equal((await active.json()).user.id, 'u-1')

    const token = cookie.slice(cookie.indexOf('=') + 1)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() - 1, tokenHash)
    const expiredSession = await fetch(`${baseUrl}/api/tickets`, { headers: { cookie } })
    assert.equal(expiredSession.status, 401)
    assert.match(expiredSession.headers.get('set-cookie'), /Max-Age=0/)

    const { cookie: secondCookie } = await login('mia.santos@example.com', 'employee-test-password')
    const signedOut = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: secondCookie },
    })
    assert.equal(signedOut.status, 204)
    assert.match(signedOut.headers.get('set-cookie'), /Max-Age=0/)
    const expired = await fetch(`${baseUrl}/api/tickets`, { headers: { cookie: secondCookie } })
    assert.equal(expired.status, 401)
  })
})

test('restricts support and employee ticket access by role and ownership', async () => {
  await withApi(async ({ request, login, db }) => {
    db.prepare('UPDATE tickets SET requester_id = ?, requester_name = ?, requester_email = ? WHERE id = ?')
      .run('u-2', 'Alex Cruz', 'alex.cruz@example.com', 't-6')
    const employeeTicketList = await request('/api/tickets')
    const employeeTickets = await employeeTicketList.json()
    assert.equal(employeeTickets.length, 5)
    assert.ok(employeeTickets.every(({ requesterId }) => requesterId === 'u-1'))
    assert.equal((await request('/api/tickets/t-6')).status, 404)

    const support = await login('alex.cruz@example.com', 'support-test-password')
    assert.equal((await request('/api/tickets/t-6', {}, support.cookie)).status, 200)
    const supportImport = await request('/api/tickets/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ migrationId: 'support-import', tickets: [] }),
    }, support.cookie)
    assert.equal(supportImport.status, 403)

    const createdResponse = await request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Private employee ticket',
        description: 'Only its requester may view this ticket.',
        category: 'other',
        priority: 'low',
        requesterId: 'u-2',
        requesterName: 'Alex Cruz',
      }),
    })
    const created = await createdResponse.json()
    assert.equal(created.requesterId, 'u-1')

    const supportCreate = await request('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Support cannot create',
        description: 'Support should work on employee reports.',
        category: 'other',
        priority: 'low',
      }),
    }, support.cookie)
    assert.equal(supportCreate.status, 403)

    assert.equal((await (await request('/api/tickets')).json()).length, 6)
  })
})

test('allows support self-assignment and unassignment without changing other ticket fields', async () => {
  await withApi(async ({ baseUrl, request, login }) => {
    const employeeDenied = await request('/api/tickets/t-1/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true }),
    })
    assert.equal(employeeDenied.status, 403)

    const support = await login('alex.cruz@example.com', 'support-test-password')
    const before = await (await request('/api/tickets/t-1', {}, support.cookie)).json()
    const assignedResponse = await request('/api/tickets/t-1/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true, assigneeId: 'u-1' }),
    }, support.cookie)
    assert.equal(assignedResponse.status, 400)

    const selfAssignResponse = await request('/api/tickets/t-1/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true }),
    }, support.cookie)
    const assigned = await selfAssignResponse.json()
    assert.equal(selfAssignResponse.status, 200)
    assert.equal(assigned.assigneeId, 'u-2')
    assert.equal(assigned.assigneeName, 'Alex Cruz')
    assert.equal(assigned.status, before.status)
    assert.equal(assigned.resolvedAt, before.resolvedAt)
    assert.equal(assigned.description, before.description)
    assert.ok(assigned.updatedAt >= before.updatedAt)

    const idempotentResponse = await request('/api/tickets/t-1/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true }),
    }, support.cookie)
    assert.equal((await idempotentResponse.json()).updatedAt, assigned.updatedAt)

    const unassignResponse = await request('/api/tickets/t-1/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: false }),
    }, support.cookie)
    const unassigned = await unassignResponse.json()
    assert.equal(unassigned.assigneeId, null)
    assert.equal(unassigned.assigneeName, null)
    assert.equal(unassigned.status, before.status)

    assert.equal((await request('/api/tickets/missing/assignee', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true }),
    }, support.cookie)).status, 404)

    const anonymous = await fetch(`${baseUrl}/api/tickets/t-1/assignee`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned: true }),
    })
    assert.equal(anonymous.status, 401)
  })
})
