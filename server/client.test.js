import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from './app.js'
import { mockTickets } from '../src/data/mockData.js'
import { filterTickets } from '../src/data/ticketQueries.js'

test('frontend API client imports legacy tickets once and uses shared data thereafter', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workhelp-client-'))
  const credentials = {
    employeePassword: 'employee-test-password',
    supportPassword: 'support-test-password',
  }
  const app = createApp(path.join(directory, 'tickets.sqlite'), { seedCredentials: credentials })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`
  const values = new Map()
  const localTickets = structuredClone(mockTickets)
  localTickets[0].status = 'in_progress'
  localTickets.push({
    ...mockTickets[0],
    id: 't-7',
    title: 'Saved only in this browser',
  })

  const originalFetch = globalThis.fetch
  const loginResponse = await originalFetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'mia.santos@example.com', password: credentials.employeePassword }),
  })
  let cookie = loginResponse.headers.get('set-cookie').split(';')[0]
  globalThis.fetch = async (input, options = {}) => {
    const response = await originalFetch(new URL(input, baseUrl), {
      ...options,
      headers: { ...(options.headers ?? {}), cookie },
    })
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    return response
  }
  globalThis.window = {
    crypto: { randomUUID: () => 'client-migration-1' },
    localStorage: {
      getItem(key) { return values.get(key) ?? null },
      setItem(key, value) { values.set(key, value) },
    },
  }
  values.set('workhelp:tickets', JSON.stringify(localTickets))

  try {
    const api = await import('../src/data/ticketStorage.js')
    const authApi = await import('../src/data/authApi.js')
    assert.equal((await authApi.getCurrentUser()).role, 'employee')
    await authApi.signOut()
    assert.equal(await authApi.getCurrentUser(), null)
    assert.equal((await authApi.signIn('mia.santos@example.com', credentials.employeePassword)).id, 'u-1')

    const firstRead = await api.getTickets()
    assert.equal(firstRead.length, 8)
    assert.equal(firstRead.filter(({ title }) => title === 'Saved only in this browser').length, 1)
    assert.equal(firstRead.find(({ id }) => id === 't-1').status, 'open')
    assert.equal(firstRead.find(({ id }) => id === 't-7').status, 'in_progress')
    assert.equal(values.get('workhelp:tickets-imported-to-api'), 'true')

    await api.createTicket({
      title: 'Created through frontend client',
      description: 'Client sends this to the shared API.',
      category: 'software',
      priority: 'urgent',
    })
    const ticketsAfterCreate = await api.getTickets()
    const created = ticketsAfterCreate.find(({ title }) => title === 'Created through frontend client')
    assert.ok(created)
    assert.equal((await api.getTicketById(created.id)).id, created.id)
    const employeeMessage = await api.createTicketMessage(created.id, 'Please let me know when there is an update.')
    assert.equal(employeeMessage.authorRole, 'employee')
    assert.equal((await api.getTicketMessages(created.id))[0].id, employeeMessage.id)

    const supportLogin = await originalFetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alex.cruz@example.com', password: credentials.supportPassword }),
    })
    cookie = supportLogin.headers.get('set-cookie').split(';')[0]
    const supportMessage = await api.createTicketMessage(created.id, 'We are checking this request.')
    const conversation = await api.getTicketMessages(created.id)
    assert.deepEqual(conversation.map(({ authorRole }) => authorRole), ['employee', 'support'])
    assert.equal(supportMessage.authorRole, 'support')
    const beforeAssignment = await api.getTicketById(created.id)
    const assigned = await api.updateTicketAssignment(created.id, true)
    assert.equal(assigned.assigneeId, 'u-2')
    assert.equal(assigned.status, beforeAssignment.status)
    assert.equal((await api.getTicketById(created.id)).assigneeId, 'u-2')
    assert.equal((await api.updateTicketStatus(created.id, 'resolved')).status, 'resolved')
    await api.updateTicketAssignment(created.id, false)
    assert.equal(await api.getTicketById('unknown-ticket'), null)

    const allTickets = await api.getTickets()
    const assignedTickets = filterTickets(allTickets, {
      query: '',
      status: 'all',
      priority: 'all',
      assigneeId: 'u-2',
    })
    assert.equal(assignedTickets.length, 4)
    assert.ok(assignedTickets.every(({ assigneeId }) => assigneeId === 'u-2'))
    assert.equal(filterTickets(allTickets, {
      query: '',
      status: 'all',
      priority: 'all',
      assigneeId: null,
    }).length, allTickets.length)
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.window
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
    app.locals.db.close()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
