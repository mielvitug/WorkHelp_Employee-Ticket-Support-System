import { currentUser, mockTickets } from './mockData'

const STORAGE_KEY = 'workhelp:tickets'
const categories = ['hardware', 'software', 'network', 'access', 'other']
const priorities = ['low', 'medium', 'high', 'urgent']
const statuses = ['open', 'in_progress', 'resolved', 'closed']

function readTickets() {
  let serializedTickets

  try {
    serializedTickets = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    throw new Error('Unable to access browser storage. Enable local storage and try again.')
  }

  if (serializedTickets === null) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockTickets))
    } catch {
      throw new Error('Unable to save tickets in this browser. Check your storage settings and try again.')
    }

    return [...mockTickets]
  }

  let tickets
  try {
    tickets = JSON.parse(serializedTickets)
  } catch {
    throw new Error('Saved ticket data is invalid. Clear WorkHelp ticket data from this browser and reload.')
  }

  const isValidTicketList = Array.isArray(tickets) && tickets.every((ticket) =>
    ticket &&
    typeof ticket.id === 'string' &&
    typeof ticket.title === 'string' &&
    typeof ticket.description === 'string' &&
    typeof ticket.requesterName === 'string' &&
    typeof ticket.createdAt === 'string' &&
    statuses.includes(ticket.status) &&
    priorities.includes(ticket.priority) &&
    categories.includes(ticket.category)
  )

  if (!isValidTicketList) {
    throw new Error('Saved ticket data is invalid. Clear WorkHelp ticket data from this browser and reload.')
  }

  return tickets
}

export function getTickets() {
  return readTickets()
}

export function createTicket({ title, description, category, priority }) {
  const trimmedTitle = title.trim()
  const trimmedDescription = description.trim()

  if (!trimmedTitle || !trimmedDescription) {
    throw new Error('Enter a title and description before submitting.')
  }

  if (!categories.includes(category) || !priorities.includes(priority)) {
    throw new Error('Choose a valid category and priority.')
  }

  const tickets = readTickets()
  const numericIds = tickets
    .map(({ id }) => Number(id.match(/^t-(\d+)$/)?.[1]))
    .filter(Number.isInteger)
  let nextId = Math.max(0, ...numericIds) + 1
  while (tickets.some((ticket) => ticket.id === `t-${nextId}`)) {
    nextId += 1
  }

  const now = new Date().toISOString()
  const ticket = {
    id: `t-${nextId}`,
    title: trimmedTitle,
    description: trimmedDescription,
    status: 'open',
    priority,
    category,
    requesterId: currentUser.id,
    requesterName: currentUser.name,
    requesterEmail: currentUser.email,
    assigneeId: null,
    assigneeName: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  }
  const updatedTickets = [ticket, ...tickets]

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTickets))
  } catch {
    throw new Error('Unable to save your ticket in this browser. Check your storage settings and try again.')
  }

  return ticket
}
