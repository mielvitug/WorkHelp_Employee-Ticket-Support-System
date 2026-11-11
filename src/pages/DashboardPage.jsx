import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTickets } from '../data/ticketStorage'
import './DashboardPage.css'

const statusMetrics = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const priorityMetrics = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function countBy(tickets, key, value) {
  return tickets.filter((ticket) => ticket[key] === value).length
}

export function DashboardPage() {
  const [dashboardState, setDashboardState] = useState({ tickets: null, error: '', loading: true })

  useEffect(() => {
    let active = true
    getTickets().then(
      (tickets) => {
        if (active) setDashboardState({ tickets, error: '', loading: false })
      },
      (error) => {
        if (active) setDashboardState({ tickets: null, error: error.message, loading: false })
      },
    )
    return () => {
      active = false
    }
  }, [])

  if (dashboardState.loading) {
    return (
      <section>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle" role="status">Loading ticket summary...</p>
      </section>
    )
  }

  if (dashboardState.error) {
    return (
      <section>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">A summary of your tickets.</p>
        <p className="dashboard-error" role="alert">{dashboardState.error}</p>
      </section>
    )
  }

  const { tickets } = dashboardState

  return (
    <section className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <p className="page-eyebrow">Your workspace</p>
          <h1 className="page-title">Good to see you.</h1>
          <p className="page-subtitle">Here’s the pulse of your support queue.</p>
        </div>
        <Link className="dashboard-action" to="/tickets">Explore tickets <span aria-hidden="true">↗</span></Link>
      </header>

      <div className="dashboard-total">
        <div className="dashboard-total-copy">
          <span className="dashboard-total-label">All tickets</span>
          <strong className="dashboard-total-value">{tickets.length}</strong>
          <span className="dashboard-total-note">Across every status and priority</span>
        </div>
        <div className="dashboard-total-art" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="orbit-core">W</span>
        </div>
      </div>

      <section className="dashboard-section" aria-labelledby="dashboard-status-heading">
        <div className="dashboard-section-heading">
          <div>
            <p className="page-eyebrow">At a glance</p>
            <h2 id="dashboard-status-heading">Ticket status</h2>
          </div>
          <span className="dashboard-section-caption">Current distribution</span>
        </div>
        <div className="dashboard-metrics">
          {statusMetrics.map((metric) => (
            <article className={`dashboard-metric dashboard-metric-${metric.value}`} key={metric.value}>
              <span className="metric-dot" aria-hidden="true" />
              <span className="dashboard-metric-label">{metric.label}</span>
              <strong>{countBy(tickets, 'status', metric.value)}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="dashboard-priority-heading">
        <div className="dashboard-section-heading">
          <div>
            <p className="page-eyebrow">Triage</p>
            <h2 id="dashboard-priority-heading">Priority mix</h2>
          </div>
          <span className="dashboard-section-caption">Requests by urgency</span>
        </div>
        <div className="dashboard-metrics">
          {priorityMetrics.map((metric) => (
            <article className={`dashboard-metric dashboard-priority-${metric.value}`} key={metric.value}>
              <span className="dashboard-metric-label">{metric.label}</span>
              <strong>{countBy(tickets, 'priority', metric.value)}</strong>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
