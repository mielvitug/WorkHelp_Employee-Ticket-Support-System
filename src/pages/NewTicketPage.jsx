import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createTicket } from '../data/ticketStorage'
import './NewTicketPage.css'

const categoryOptions = [
  { value: 'hardware', label: 'Hardware' },
  { value: 'software', label: 'Software' },
  { value: 'network', label: 'Network' },
  { value: 'access', label: 'Access' },
  { value: 'other', label: 'Other' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export function NewTicketPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setIsSubmitting(true)

    try {
      await createTicket({ title, description, category, priority })
      navigate('/tickets')
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="new-ticket-page">
      <p className="page-eyebrow">Let’s get this sorted</p>
      <h1 className="page-title">Create a ticket</h1>
      <p className="page-subtitle">Describe the issue you need help with.</p>

      <form className="ticket-form" onSubmit={handleSubmit}>
        <label className="ticket-form-field" htmlFor="ticket-title">
          <span>Title</span>
          <input
            id="ticket-title"
            name="title"
            type="text"
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label className="ticket-form-field" htmlFor="ticket-description">
          <span>Description</span>
          <textarea
            id="ticket-description"
            name="description"
            rows={5}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>

        <div className="ticket-form-row">
          <label className="ticket-form-field" htmlFor="ticket-category">
            <span>Category</span>
            <select
              id="ticket-category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            >
              <option value="" disabled>Select a category</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ticket-form-field" htmlFor="ticket-priority">
            <span>Priority</span>
            <select
              id="ticket-priority"
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              required
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {submitError && (
          <p className="ticket-storage-error" role="alert">{submitError}</p>
        )}

        <div className="ticket-form-actions">
          <Link className="ticket-form-cancel" to="/tickets">Cancel</Link>
          <button className="ticket-form-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </section>
  )
}
