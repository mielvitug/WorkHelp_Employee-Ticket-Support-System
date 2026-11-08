import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getTickets } from '../data/ticketStorage'
import { TicketCard } from '../components/tickets/TicketCard'
import { TicketFilters } from '../components/tickets/TicketFilters'
import './TicketsPage.css'

export function TicketsPage() {
  const [ticketState] = useState(() => {
    try {
      return { tickets: getTickets(), error: '' }
    } catch (error) {
      return { tickets: null, error: error.message }
    }
  })
  const { tickets, error: loadError } = ticketState
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')

  const visibleTickets = (tickets ?? []).filter((ticket) => {
    const matchesQuery = ticket.title
      .toLowerCase()
      .includes(query.trim().toLowerCase())
    const matchesStatus = status === 'all' || ticket.status === status
    const matchesPriority = priority === 'all' || ticket.priority === priority

    return matchesQuery && matchesStatus && matchesPriority
  })

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setPriority('all')
  }

  return (
    <section>
      <div className="ticket-page-header">
        <div>
          <h1 className="page-title">Tickets</h1>
          {tickets && (
            <p className="page-subtitle">
              {visibleTickets.length} of {tickets.length} tickets
            </p>
          )}
        </div>
        <Link className="ticket-create-link" to="/tickets/new">New ticket</Link>
      </div>

      {loadError ? (
        <p className="ticket-storage-error" role="alert">{loadError}</p>
      ) : tickets === null ? (
        <p className="ticket-empty" role="status">Loading tickets...</p>
      ) : (
        <>
          <TicketFilters
            query={query}
            status={status}
            priority={priority}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onPriorityChange={setPriority}
            onClear={clearFilters}
          />

          {visibleTickets.length === 0 ? (
            <p className="ticket-empty">No tickets match your filters.</p>
          ) : (
            <div className="ticket-list">
              {visibleTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}