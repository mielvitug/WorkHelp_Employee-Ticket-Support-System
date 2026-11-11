import assert from 'node:assert/strict'
import test from 'node:test'
import { filterTickets } from '../src/data/ticketQueries.js'

test('frontend auth and ticket data stay in this browser without an API', async () => {
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem(key) { return values.get(key) ?? null },
      setItem(key, value) { values.set(key, value) },
      removeItem(key) { values.delete(key) },
    },
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('The browser-local app must not call the API.')
  }

  try {
    const auth = await import('../src/data/authApi.js')
    const ticketsApi = await import('../src/data/ticketStorage.js')
    assert.equal(await auth.getCurrentUser(), null)

    const employee = await auth.signIn(' Mia.Santos@example.com ', 'DemoEmployee!2026')
    assert.equal(employee.role, 'employee')
    assert.equal((await ticketsApi.getTickets()).length, 6)

    const created = await ticketsApi.createTicket({
      title: 'Saved only in this browser',
      description: 'This ticket should survive reloading this browser.',
      category: 'software',
      priority: 'urgent',
    })
    assert.equal(created.requesterId, employee.id)
    const reply = await ticketsApi.createTicketMessage(created.id, 'Please take a look.')
    assert.equal(reply.authorRole, 'employee')
    assert.equal((await ticketsApi.getTicketMessages(created.id))[0].id, reply.id)

    await auth.signOut()
    const support = await auth.signIn('alex.cruz@example.com', 'DemoSupport!2026')
    assert.equal(support.role, 'support')
    const supportTickets = await ticketsApi.getTickets()
    assert.equal(supportTickets.length, 7)
    const assigned = await ticketsApi.updateTicketAssignment(created.id, true)
    assert.equal(assigned.assigneeId, support.id)
    assert.equal((await ticketsApi.getTicketMessages(created.id))[0].authorRole, 'employee')

    const archived = await ticketsApi.updateTicketArchived(created.id, true)
    assert.ok(archived.archivedAt)
    assert.equal((await ticketsApi.getTickets()).length, 6)
    assert.equal((await ticketsApi.getTickets({ archived: true }))[0].id, created.id)
    await assert.rejects(
      ticketsApi.createTicketMessage(created.id, 'This should not be sent.'),
      /Restore this ticket/,
    )
    await ticketsApi.updateTicketArchived(created.id, false)

    const filtered = filterTickets(await ticketsApi.getTickets(), {
      query: 'saved only',
      status: 'all',
      priority: 'all',
      assigneeId: support.id,
    })
    assert.deepEqual(filtered.map(({ id }) => id), [created.id])
    assert.ok(values.has('workhelp:browser-tickets'))
    assert.ok(values.has('workhelp:browser-messages'))
    assert.ok(values.get('workhelp:local-accounts').includes('"passwordHash"'))
    assert.equal(values.get('workhelp:local-accounts').includes('"password":"'), false)

    await auth.changePassword('DemoSupport!2026', 'UpdatedSupport!2026')
    await auth.signOut()
    await assert.rejects(auth.signIn('alex.cruz@example.com', 'DemoSupport!2026'), /incorrect/)
    assert.equal((await auth.signIn('alex.cruz@example.com', 'UpdatedSupport!2026')).role, 'support')
    await ticketsApi.updateTicketArchived(created.id, true)
    await auth.signOut()
    await assert.rejects(ticketsApi.getTickets({ archived: true }), /Sign in/)

    const registered = await auth.registerEmployee({
      name: 'Browser User',
      email: '  browser.user@example.com ',
      password: 'BrowserPassword!2026',
    })
    assert.equal(registered.email, 'browser.user@example.com')
    assert.equal((await ticketsApi.getTickets()).length, 0)
    await assert.rejects(ticketsApi.updateTicketArchived(created.id, false), /Only support/)
    await auth.changePassword('BrowserPassword!2026', 'NewBrowserPassword!2026')
    await auth.signOut()
    assert.equal(
      (await auth.signIn('browser.user@example.com', 'NewBrowserPassword!2026')).id,
      registered.id,
    )
  } finally {
    globalThis.fetch = originalFetch
    delete globalThis.window
  }
})
