const LEGACY_TICKETS_KEY = 'workhelp:tickets'
const IMPORTED_KEY = 'workhelp:tickets-imported-to-api'
const MIGRATION_ID_KEY = 'workhelp:tickets-migration-id'
let migrationPromise

async function request(path, options) {
  let response
  try {
    response = await fetch(`/api${path}`, options)
  } catch {
    throw new Error('Unable to connect to the WorkHelp API. Start the API server and try again.')
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(
      `The WorkHelp API returned a non-JSON response (HTTP ${response.status}). Start the API on 127.0.0.1:3001, then restart Vite.`,
    )
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('The WorkHelp API returned an invalid response.')
  }

  if (!response.ok) {
    const error = new Error(body.error ?? 'The WorkHelp API request failed.')
    error.status = response.status
    throw error
  }

  return body
}

async function importLegacyTickets() {
  let imported
  let legacyTickets
  let migrationId

  const { user } = await requestAuthSession()
  if (user?.role !== 'employee') {
    return false
  }

  try {
    imported = window.localStorage.getItem(IMPORTED_KEY)
    if (imported === 'true') {
      return
    }

    const serializedTickets = window.localStorage.getItem(LEGACY_TICKETS_KEY)
    if (serializedTickets === null) {
      window.localStorage.setItem(IMPORTED_KEY, 'true')
      return
    }

    legacyTickets = JSON.parse(serializedTickets)
    if (!Array.isArray(legacyTickets)) {
      throw new Error('Saved browser ticket data is invalid. It has not been imported.')
    }

    migrationId = window.localStorage.getItem(MIGRATION_ID_KEY)
    if (!migrationId) {
      migrationId = window.crypto.randomUUID()
      window.localStorage.setItem(MIGRATION_ID_KEY, migrationId)
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Saved browser ticket data is invalid JSON. It has not been imported.')
    }
    if (error instanceof Error && error.message.includes('has not been imported')) {
      throw error
    }
    throw new Error('Unable to read or mark saved browser tickets for import.')
  }

  await request('/tickets/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ migrationId, tickets: legacyTickets }),
  })

  try {
    window.localStorage.setItem(IMPORTED_KEY, 'true')
  } catch {
    throw new Error('Tickets were imported, but this browser could not save the import marker. Reload to safely retry.')
  }
  return true
}

async function requestAuthSession() {
  let response
  try {
    response = await fetch('/api/auth/session', { credentials: 'same-origin' })
  } catch {
    throw new Error('Unable to connect to the WorkHelp API. Start the API server and try again.')
  }

  if (!response.ok) {
    throw new Error('Unable to check your sign-in before importing saved tickets.')
  }
  return response.json()
}

function ensureLegacyTicketsImported() {
  if (!migrationPromise) {
    migrationPromise = importLegacyTickets().then(
      (completed) => {
        if (!completed) migrationPromise = undefined
      },
      (error) => {
        migrationPromise = undefined
        throw error
      },
    )
  }
  return migrationPromise
}

export async function getTickets() {
  await ensureLegacyTicketsImported()
  return request('/tickets')
}

export async function getTicketById(ticketId) {
  await ensureLegacyTicketsImported()
  try {
    return await request(`/tickets/${encodeURIComponent(ticketId)}`)
  } catch (error) {
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getTicketMessages(ticketId) {
  await ensureLegacyTicketsImported()
  return request(`/tickets/${encodeURIComponent(ticketId)}/messages`)
}

export async function createTicketMessage(ticketId, content) {
  await ensureLegacyTicketsImported()
  return request(`/tickets/${encodeURIComponent(ticketId)}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export async function updateTicketStatus(ticketId, status) {
  await ensureLegacyTicketsImported()
  return request(`/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function updateTicketAssignment(ticketId, assigned) {
  await ensureLegacyTicketsImported()
  return request(`/tickets/${encodeURIComponent(ticketId)}/assignee`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assigned }),
  })
}

export async function createTicket({ title, description, category, priority }) {
  await ensureLegacyTicketsImported()
  return request('/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, description, category, priority }),
  })
}
