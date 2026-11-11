import { getCurrentUser } from './authApi.js'
import { mockTickets } from './mockData.js'

const ticketsKey = 'workhelp:browser-tickets'
const messagesKey = 'workhelp:browser-messages'
const legacyTicketsKey = 'workhelp:tickets'
const statuses = new Set(['open', 'in_progress', 'resolved', 'closed'])
const priorities = new Set(['low', 'medium', 'high', 'urgent'])
const categories = new Set(['hardware', 'software', 'network', 'access', 'other'])
const maxMessageLength = 2000

function readJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return stored === null ? fallback : JSON.parse(stored)
  } catch {
    throw new Error('Unable to read WorkHelp data from this browser. Check browser storage settings and try again.')
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Unable to save WorkHelp data in this browser. Check available storage and privacy settings.')
  }
}

function readTickets() {
  const saved = readJson(ticketsKey, null)
  if (saved !== null) {
    if (!Array.isArray(saved)) throw new Error('Saved tickets are invalid. Clear this site’s browser data to start over.')
    return saved
  }

  const legacy = readJson(legacyTicketsKey, null)
  if (legacy !== null && !Array.isArray(legacy)) {
    throw new Error('Saved browser ticket data is invalid. It has not been replaced.')
  }
  const initialTickets = legacy ?? mockTickets
  const tickets = initialTickets.map((ticket) => ({ archivedAt: null, ...ticket }))
  writeJson(ticketsKey, tickets)
  return tickets
}

function readMessages() {
  const messages = readJson(messagesKey, {})
  if (!messages || Array.isArray(messages) || typeof messages !== 'object') {
    throw new Error('Saved ticket replies are invalid. Clear this site’s browser data to start over.')
  }
  return messages
}

function writeTickets(tickets) {
  writeJson(ticketsKey, tickets)
}

function requireUser() {
  return getCurrentUser().then((user) => {
    if (!user) throw new Error('Sign in to use tickets.')
    return user
  })
}

function findAccessibleTicket(tickets, user, ticketId) {
  const ticket = tickets.find(({ id }) => id === ticketId)
  if (!ticket || (user.role !== 'support' && ticket.requesterId !== user.id)) return null
  return ticket
}

export async function getTickets({ archived = false } = {}) {
  const user = await requireUser()
  if (archived && user.role !== 'support') {
    throw new Error('Only support users may view archived tickets.')
  }
  return readTickets().filter((ticket) => {
    const owned = user.role === 'support' || ticket.requesterId === user.id
    return owned && Boolean(ticket.archivedAt) === archived
  })
}

export async function getTicketById(ticketId) {
  const user = await requireUser()
  const ticket = findAccessibleTicket(readTickets(), user, ticketId)
  if (!ticket || (user.role !== 'support' && ticket.archivedAt)) return null
  return ticket
}

export async function getTicketMessages(ticketId) {
  const user = await requireUser()
  const ticket = findAccessibleTicket(readTickets(), user, ticketId)
  if (!ticket || (user.role !== 'support' && ticket.archivedAt)) {
    throw new Error('Ticket not found.')
  }
  const conversation = readMessages()[ticketId] ?? []
  if (!Array.isArray(conversation)) {
    throw new Error('Saved replies for this ticket are invalid.')
  }
  return conversation
}

export async function createTicketMessage(ticketId, content) {
  const user = await requireUser()
  const tickets = readTickets()
  const ticket = findAccessibleTicket(tickets, user, ticketId)
  if (!ticket) throw new Error('Ticket not found.')
  if (ticket.archivedAt) throw new Error('Restore this ticket before adding a reply.')
  if (typeof content !== 'string' || !content.trim() || content.trim().length > maxMessageLength) {
    throw new Error(`Reply must contain 1 to ${maxMessageLength} characters.`)
  }

  const messages = readMessages()
  const conversation = messages[ticketId] ?? []
  if (!Array.isArray(conversation)) {
    throw new Error('Saved replies for this ticket are invalid.')
  }
  const message = {
    id: conversation.reduce((highest, item) => Math.max(highest, item.id), 0) + 1,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  }
  writeJson(messagesKey, { ...messages, [ticketId]: [...conversation, message] })
  writeTickets(tickets.map((item) => item.id === ticketId
    ? { ...item, updatedAt: message.createdAt }
    : item))
  return message
}

export async function updateTicketStatus(ticketId, status) {
  const user = await requireUser()
  if (user.role !== 'support') throw new Error('Only support users may update ticket status.')
  if (!statuses.has(status)) throw new Error('Choose a valid ticket status.')
  const tickets = readTickets()
  const ticket = tickets.find(({ id }) => id === ticketId)
  if (!ticket) throw new Error('Ticket not found.')
  if (ticket.archivedAt) throw new Error('Restore this ticket before updating its status.')
  if (ticket.status === status) return ticket

  const now = new Date().toISOString()
  const updated = {
    ...ticket,
    status,
    updatedAt: now,
    resolvedAt: status === 'resolved' || status === 'closed'
      ? ticket.resolvedAt ?? now
      : null,
  }
  writeTickets(tickets.map((item) => item.id === ticketId ? updated : item))
  return updated
}

export async function updateTicketAssignment(ticketId, assigned) {
  const user = await requireUser()
  if (user.role !== 'support') throw new Error('Only support users may update ticket assignments.')
  const tickets = readTickets()
  const ticket = tickets.find(({ id }) => id === ticketId)
  if (!ticket) throw new Error('Ticket not found.')
  if (ticket.archivedAt) throw new Error('Restore this ticket before updating its assignment.')
  if (typeof assigned !== 'boolean') throw new Error('Choose whether to assign this ticket to yourself.')

  const assigneeId = assigned ? user.id : null
  const assigneeName = assigned ? user.name : null
  if (ticket.assigneeId === assigneeId && ticket.assigneeName === assigneeName) return ticket
  const updated = {
    ...ticket,
    assigneeId,
    assigneeName,
    updatedAt: new Date().toISOString(),
  }
  writeTickets(tickets.map((item) => item.id === ticketId ? updated : item))
  return updated
}

export async function updateTicketArchived(ticketId, archived) {
  const user = await requireUser()
  if (user.role !== 'support') throw new Error('Only support users may archive tickets.')
  if (typeof archived !== 'boolean') throw new Error('Choose whether to archive this ticket.')
  const tickets = readTickets()
  const ticket = tickets.find(({ id }) => id === ticketId)
  if (!ticket) throw new Error('Ticket not found.')
  if (Boolean(ticket.archivedAt) === archived) return ticket

  const now = new Date().toISOString()
  const updated = { ...ticket, archivedAt: archived ? now : null, updatedAt: now }
  writeTickets(tickets.map((item) => item.id === ticketId ? updated : item))
  return updated
}

export async function createTicket({ title, description, category, priority }) {
  const user = await requireUser()
  if (user.role !== 'employee') throw new Error('Only employee users may create tickets.')
  if (
    typeof title !== 'string' || !title.trim() || title.length > 120 ||
    typeof description !== 'string' || !description.trim() || description.length > 2000 ||
    !categories.has(category) || !priorities.has(priority)
  ) {
    throw new Error('Enter a title and description, and choose a valid category and priority.')
  }

  const tickets = readTickets()
  const nextId = tickets.reduce((highest, ticket) => {
    const number = /^t-(\d+)$/.exec(ticket.id)?.[1]
    return number ? Math.max(highest, Number(number)) : highest
  }, 0) + 1
  const now = new Date().toISOString()
  const ticket = {
    id: `t-${nextId}`,
    title: title.trim(),
    description: description.trim(),
    status: 'open',
    priority,
    category,
    requesterId: user.id,
    requesterName: user.name,
    requesterEmail: user.email,
    assigneeId: null,
    assigneeName: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    archivedAt: null,
  }
  writeTickets([...tickets, ticket])
  return ticket
}
