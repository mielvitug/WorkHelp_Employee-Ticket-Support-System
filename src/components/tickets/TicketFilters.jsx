import './TicketFilters.css'

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const priorityOptions = [
  { value: 'all', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function TicketFilters({
  query,
  status,
  priority,
  onQueryChange,
  onStatusChange,
  onPriorityChange,
  onClear,
}) {
  return (
    <div className="ticket-filters">
      <input
        className="ticket-filters-search"
        type="search"
        placeholder="Search tickets..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

      <select
        className="ticket-filters-select"
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        {statusOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className="ticket-filters-select"
        value={priority}
        onChange={(event) => onPriorityChange(event.target.value)}
      >
        {priorityOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button type="button" className="ticket-filters-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  )
}