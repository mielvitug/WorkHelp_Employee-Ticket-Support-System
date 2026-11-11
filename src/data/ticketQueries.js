export function filterTickets(tickets, { query, status, priority, assigneeId }) {
  const normalizedQuery = query.trim().toLowerCase()

  return tickets.filter((ticket) => {
    const matchesQuery = ticket.title.toLowerCase().includes(normalizedQuery)
    const matchesStatus = status === 'all' || ticket.status === status
    const matchesPriority = priority === 'all' || ticket.priority === priority
    const matchesAssignee = !assigneeId || ticket.assigneeId === assigneeId
    return matchesQuery && matchesStatus && matchesPriority && matchesAssignee
  })
}
