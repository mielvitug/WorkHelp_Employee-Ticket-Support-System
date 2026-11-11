import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import './AuthForms.css'

const minPasswordLength = 12
const maxPasswordLength = 35

export function RegisterPage() {
  const { user, loading, register, sessionError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (loading) {
    return (
      <main className="standalone-page">
        <p className="page-subtitle" role="status">Checking your sign-in...</p>
      </main>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    if (password !== confirmPassword) {
      setSubmitError('The passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await register(name, email, password)
      navigate(location.state?.from ?? '/dashboard', { replace: true })
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="standalone-page account-page">
      <div className="login-brand">
        <span className="brand-mark" aria-hidden="true">w</span>
        <span className="brand-name">workhelp<span className="brand-period">.</span></span>
      </div>
      <p className="page-eyebrow">Join your support workspace</p>
      <h1 className="page-title">Create an account.</h1>
      <p className="page-subtitle">Employee accounts can create and track their own tickets.</p>

      {sessionError && <p className="account-message account-error" role="alert">{sessionError}</p>}

      <form className="account-form" onSubmit={handleSubmit}>
        <label className="account-field" htmlFor="register-name">
          <span>Name</span>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className="account-field" htmlFor="register-email">
          <span>Email</span>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="account-field" htmlFor="register-password">
          <span>Password</span>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            minLength={minPasswordLength}
            maxLength={maxPasswordLength}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="account-field" htmlFor="register-confirm-password">
          <span>Confirm password</span>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={minPasswordLength}
            maxLength={maxPasswordLength}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <span className="account-field-hint">Use {minPasswordLength}–{maxPasswordLength} characters.</span>
        </label>

        {submitError && <p className="account-message account-error" role="alert">{submitError}</p>}

        <button className="account-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Create employee account'}
        </button>
      </form>

      <p className="account-footer">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </main>
  )
}
