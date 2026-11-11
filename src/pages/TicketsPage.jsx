import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { getTickets } from '../data/ticketStorage'
import { filterTickets } from '../data/ticketQueries'
import { TicketCard } from '../components/tickets/TicketCard'
import { TicketFilters } from '../components/tickets/TicketFilters'
import './TicketsPage.css'

export function TicketsPage() {
  const { user } = useAuth()
  const [ticketState, setTicketState] = useState({ tickets: null, error: '', archivedOnly: false })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [archivedOnly, setArchivedOnly] = useState(false)
  const isCurrentTicketState = ticketState.archivedOnly === archivedOnly
  const tickets = isCurrentTicketState ? ticketState.tickets : null
  const loadError = isCurrentTicketState ? ticketState.error : ''

  useEffect(() => {
    let active = true
    getTickets({ archived: archivedOnly }).then(
      (loadedTickets) => {
        if (active) setTicketState({ tickets: loadedTickets, error: '', archivedOnly })
      },
      (error) => {
        if (active) setTicketState({ tickets: null, error: error.message, archivedOnly })
      },
    )
    return () => {
      active = false
    }
  }, [archivedOnly])

  const visibleTickets = filterTickets(tickets ?? [], {
    query,
    status,
    priority,
    assigneeId: assignedToMe ? user.id : null,
  })

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setPriority('all')
    setAssignedToMe(false)
  }

  const toggleArchived = () => {
    clearFilters()
    setArchivedOnly((current) => !current)
  }

  return (
    <section className="tickets-page">
      <div className="ticket-page-header">
        <div>
          <p className="page-eyebrow">Support workspace</p>
          <h1 className="page-title">{archivedOnly ? 'Archived tickets' : 'Tickets'}</h1>
          {tickets && (
            <p className="page-subtitle">{visibleTickets.length} in view <span className="count-divider">/</span> {tickets.length} total</p>
          )}
        </div>
        {user.role === 'employee' && (
          <Link className="ticket-create-link" to="/tickets/new">New ticket</Link>
        )}
        {user.role === 'support' && (
          <button className="ticket-archive-view-toggle" type="button" onClick={toggleArchived}>
            {archivedOnly ? 'View active tickets' : 'View archived'}
          </button>
        )}
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
            assignedToMe={assignedToMe}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onPriorityChange={setPriority}
            onAssignedToMeChange={user.role === 'support' ? setAssignedToMe : undefined}
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