import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Badge } from '../components/ui/Badge'
import {
  createTicketMessage,
  getTicketById,
  getTicketMessages,
  updateTicketArchived,
  updateTicketAssignment,
  updateTicketStatus,
} from '../data/ticketStorage'
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

const statusLabels = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const statusTones = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

export function TicketDetailPage() {
  const { user } = useAuth()
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const [ticketState, setTicketState] = useState({ ticket: null, error: '', loading: true, ticketId: null })
  const [conversationState, setConversationState] = useState({
    messages: null,
    error: '',
    loading: true,
    ticketId: null,
  })
  const [statusSaving, setStatusSaving] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [archiveSaving, setArchiveSaving] = useState(false)
  const [replyDraft, setReplyDraft] = useState({ ticketId: null, value: '' })
  const [replyErrorState, setReplyErrorState] = useState({ ticketId: null, error: '' })
  const [replySaving, setReplySaving] = useState(false)
  const reply = replyDraft.ticketId === ticketId ? replyDraft.value : ''
  const replyError = replyErrorState.ticketId === ticketId ? replyErrorState.error : ''

  useEffect(() => {
    let active = true
    getTicketById(ticketId).then(
      (ticket) => {
        if (!active) return
        setTicketState({ ticket, error: '', loading: false, ticketId })
        if (!ticket) {
          setConversationState({ messages: [], error: '', loading: false, ticketId })
          return
        }
        getTicketMessages(ticketId).then(
          (messages) => {
            if (active) setConversationState({ messages, error: '', loading: false, ticketId })
          },
          (error) => {
            if (active) setConversationState({ messages: null, error: error.message, loading: false, ticketId })
          },
        )
      },
      (error) => {
        if (active) {
          setTicketState({ ticket: null, error: error.message, loading: false, ticketId })
          setConversationState({ messages: null, error: '', loading: false, ticketId })
        }
      },
    )
    return () => {
      active = false
    }
  }, [ticketId])

  const updateStatus = async (event) => {
    setStatusSaving(true)
    try {
      const ticket = await updateTicketStatus(ticketId, event.target.value)
      setTicketState({ ticket, error: '', loading: false, ticketId })
    } catch (error) {
      setTicketState((current) => ({ ...current, error: error.message }))
    } finally {
      setStatusSaving(false)
    }
  }

  const updateAssignment = async (assigned) => {
    setAssignmentSaving(true)
    try {
      const ticket = await updateTicketAssignment(ticketId, assigned)
      setTicketState({ ticket, error: '', loading: false, ticketId })
    } catch (error) {
      setTicketState((current) => ({ ...current, error: error.message }))
    } finally {
      setAssignmentSaving(false)
    }
  }

  const updateArchived = async (archived) => {
    if (archiveSaving) return
    if (archived && !window.confirm('Archive this ticket? You can restore it later from Archived tickets.')) {
      return
    }

    setArchiveSaving(true)
    try {
      await updateTicketArchived(ticketId, archived)
      navigate('/tickets')
    } catch (error) {
      setTicketState((current) => ({ ...current, error: error.message }))
    } finally {
      setArchiveSaving(false)
    }
  }

  const submitReply = async (event) => {
    event.preventDefault()
    const content = reply.trim()
    if (!content || replySaving) return

    setReplyErrorState({ ticketId, error: '' })
    setReplySaving(true)
    try {
      const message = await createTicketMessage(ticketId, content)
      setConversationState((current) => ({
        messages: [...(current.messages ?? []), message],
        error: '',
        loading: false,
        ticketId,
      }))
      setTicketState((current) => ({
        ...current,
        ticket: current.ticket ? { ...current.ticket, updatedAt: message.createdAt } : null,
      }))
      setReplyDraft({ ticketId, value: '' })
    } catch (error) {
      setReplyErrorState({ ticketId, error: error.message })
    } finally {
      setReplySaving(false)
    }
  }

  if (ticketState.loading || ticketState.ticketId !== ticketId) {
    return (
      <section>
        <h1 className="page-title">Ticket details</h1>
        <p className="page-subtitle" role="status">Loading ticket...</p>
      </section>
    )
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
  const isArchived = Boolean(ticket.archivedAt)

  return (
    <section className="ticket-detail">
      <Link className="ticket-detail-back" to="/tickets">← Back to tickets</Link>
      <div className="ticket-detail-header">
        <div>
          <p className="page-eyebrow">Ticket overview</p>
          <p className="ticket-detail-id">Ticket #{ticket.id.replace('t-', '')}</p>
          <h1 className="page-title">{ticket.title}</h1>
        </div>
        <div className="ticket-detail-badges">
          {isArchived && <Badge tone="neutral">Archived</Badge>}
          <Badge tone={priorityTones[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
        </div>
      </div>

      {isArchived && (
        <p className="ticket-archived-notice" role="status">
          This ticket is archived. Its history is preserved, but replies and updates are paused.
        </p>
      )}

      {user.role === 'support' && (
        <div className="ticket-archive-actions">
          <button
            className={`ticket-archive-button${isArchived ? ' ticket-restore-button' : ''}`}
            type="button"
            onClick={() => updateArchived(!isArchived)}
            disabled={archiveSaving}
          >
            {archiveSaving ? 'Saving...' : isArchived ? 'Restore ticket' : 'Archive ticket'}
          </button>
        </div>
      )}

      {ticketState.error && (
        <p className="ticket-storage-error" role="alert">{ticketState.error}</p>
      )}

      <div className="ticket-detail-content">
        <section className="ticket-detail-description">
          <h2>Issue summary</h2>
          <p>{ticket.description}</p>
        </section>

        <section className="ticket-detail-section">
          <h2>Ticket details</h2>
          <dl className="ticket-detail-grid">
            <div>
              <dt>Status</dt>
              <dd>
                {user.role === 'support' ? (
                  <select
                    aria-label="Ticket status"
                    className="ticket-status-select"
                    value={ticket.status}
                    onChange={updateStatus}
                    disabled={statusSaving || isArchived}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge tone={statusTones[ticket.status]}>{statusLabels[ticket.status]}</Badge>
                )}
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
              <dd className="ticket-assignee-value">
                <span>{ticket.assigneeName ?? 'Unassigned'}</span>
                {user.role === 'support' && !isArchived && (
                  <button
                    className="ticket-assignment-button"
                    type="button"
                    onClick={() => updateAssignment(ticket.assigneeId !== user.id)}
                    disabled={assignmentSaving}
                  >
                    {assignmentSaving
                      ? 'Saving...'
                      : ticket.assigneeId === user.id
                        ? 'Unassign me'
                        : 'Assign to me'}
                  </button>
                )}
              </dd>
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
            {ticket.archivedAt && (
              <div>
                <dt>Archived</dt>
                <dd>{formatDate(ticket.archivedAt)}</dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="ticket-conversation" aria-labelledby="ticket-conversation-heading">
        <div className="ticket-conversation-header">
          <div>
            <p className="page-eyebrow">Keep the conversation going</p>
            <h2 id="ticket-conversation-heading">Replies</h2>
          </div>
          <span className="ticket-conversation-count">
            {conversationState.messages?.length ?? 0}
          </span>
        </div>

        {conversationState.loading || conversationState.ticketId !== ticketId ? (
          <p className="ticket-conversation-status" role="status">Loading replies...</p>
        ) : conversationState.error ? (
          <p className="ticket-storage-error" role="alert">{conversationState.error}</p>
        ) : conversationState.messages.length === 0 ? (
          <p className="ticket-conversation-empty">No replies yet. Add a message to start the conversation.</p>
        ) : (
          <ol className="ticket-message-list">
            {conversationState.messages.map((message) => (
              <li
                className={`ticket-message ${message.authorRole === 'support' ? 'ticket-message-support' : 'ticket-message-employee'}${message.authorId === user.id ? ' ticket-message-own' : ''}`}
                key={message.id}
              >
                <article className="ticket-message-card">
                  <header className="ticket-message-header">
                    <div className="ticket-message-author">
                      <span className="ticket-message-avatar" aria-hidden="true">
                        {message.authorName.charAt(0)}
                      </span>
                      <strong>{message.authorName}</strong>
                      <Badge tone={message.authorRole === 'support' ? 'success' : 'neutral'}>
                        {message.authorRole}
                      </Badge>
                    </div>
                    <time className="ticket-message-time" dateTime={message.createdAt}>
                      {formatDate(message.createdAt)}
                    </time>
                  </header>
                  <p className="ticket-message-content">{message.content}</p>
                </article>
              </li>
            ))}
          </ol>
        )}

        {isArchived ? (
          <p className="ticket-conversation-status">Restore this ticket to add a reply.</p>
        ) : (
          <form className="ticket-reply-form" onSubmit={submitReply}>
            <label className="ticket-reply-label" htmlFor="ticket-reply">Add a reply</label>
            <textarea
              id="ticket-reply"
              className="ticket-reply-input"
              value={reply}
              onChange={(event) => setReplyDraft({ ticketId, value: event.target.value })}
              placeholder="Write a message for the requester and support team..."
              maxLength={2000}
              rows={4}
              required
            />
            {replyError && <p className="ticket-storage-error" role="alert">{replyError}</p>}
            <div className="ticket-reply-footer">
              <span className="ticket-reply-note">Visible to the requester and support team</span>
              <button
                className="ticket-reply-submit"
                type="submit"
                disabled={
                  replySaving ||
                  !reply.trim() ||
                  conversationState.loading ||
                  conversationState.ticketId !== ticketId ||
                  Boolean(conversationState.error)
                }
              >
                {replySaving ? 'Sending...' : 'Send reply'}
              </button>
            </div>
          </form>
        )}
      </section>

    </section>
  )
}
