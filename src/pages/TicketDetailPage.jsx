import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/Badge'
import { getTicketById, updateTicketStatus } from '../data/ticketStorage'
import './TicketDetailPage.css'

const categoryLabels = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  access: 'Access',
  other: 'Other',
}

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

const priorityTones = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function formatDate(value) {
  return new Date(value).toLocaleString()
}

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const [ticketState, setTicketState] = useState(() => {
    try {
      return { ticket: getTicketById(ticketId), error: '' }
    } catch (error) {
      return { ticket: null, error: error.message }
    }
  })

  const updateStatus = (event) => {
    try {
      const ticket = updateTicketStatus(ticketId, event.target.value)
      setTicketState({ ticket, error: '' })
    } catch (error) {
      setTicketState((current) => ({ ...current, error: error.message }))
    }
  }

  if (ticketState.error && !ticketState.ticket) {
    return (
      <section>
        <h1 className="page-title">Unable to load ticket</h1>
        <p className="ticket-storage-error" role="alert">{ticketState.error}</p>
        <Link className="ticket-detail-back" to="/tickets">Back to tickets</Link>
      </section>
    )
  }

  if (!ticketState.ticket) {
    return (
      <section>
        <h1 className="page-title">Ticket not found</h1>
        <p className="page-subtitle">This ticket may have been removed or the link may be incorrect.</p>
        <Link className="ticket-detail-back" to="/tickets">Back to tickets</Link>
      </section>
    )
  }

  const { ticket } = ticketState

  return (
    <section className="ticket-detail">
      <Link className="ticket-detail-back" to="/tickets">← Back to tickets</Link>
      <div className="ticket-detail-header">
        <div>
          <p className="ticket-detail-id">Ticket #{ticket.id.replace('t-', '')}</p>
          <h1 className="page-title">{ticket.title}</h1>
        </div>
        <div className="ticket-detail-badges">
          <Badge tone={priorityTones[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
        </div>
      </div>

      <div className="ticket-detail-content">
        <section className="ticket-detail-description">
          <h2>Description</h2>
          <p>{ticket.description}</p>
        </section>

        <section className="ticket-detail-section">
          <h2>Ticket details</h2>
          <dl className="ticket-detail-grid">
            <div>
              <dt>Status</dt>
              <dd>
                <select
                  aria-label="Ticket status"
                  className="ticket-status-select"
                  value={ticket.status}
                  onChange={updateStatus}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{categoryLabels[ticket.category]}</dd>
            </div>
            <div>
              <dt>Requester</dt>
              <dd>{ticket.requesterName} ({ticket.requesterEmail})</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{ticket.assigneeName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(ticket.updatedAt)}</dd>
            </div>
            {ticket.resolvedAt && (
              <div>
                <dt>Resolved</dt>
                <dd>{formatDate(ticket.resolvedAt)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      {ticketState.error && (
        <p className="ticket-storage-error" role="alert">{ticketState.error}</p>
      )}
    </section>
  )
}
