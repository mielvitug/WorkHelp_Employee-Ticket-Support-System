import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { demoAccounts } from '../data/demoCredentials'
import './LoginPage.css'

export function LoginPage() {
  const { user, loading, login, sessionError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate(location.state?.from ?? '/dashboard', { replace: true })
    } catch (error) {
      setSubmitError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUseDemoAccount = (account) => {
    setEmail(account.email)
    setPassword(account.password)
    setSubmitError('')
  }

  return (
    <main className="standalone-page login-page">
      <div className="login-brand">
        <span className="brand-mark" aria-hidden="true">w</span>
        <span className="brand-name">workhelp<span className="brand-period">.</span></span>
      </div>
      <p className="page-eyebrow">Your support, in one place</p>
      <h1 className="page-title">Welcome back.</h1>
      <p className="page-subtitle">Sign in to pick up where you left off.</p>

      <aside className="demo-signins" aria-labelledby="demo-signins-title">
        <div className="demo-signins-heading">
          <h2 id="demo-signins-title">Browser-local demo accounts</h2>
          <p>Choose an account to fill the sign-in form.</p>
        </div>
        <div className="demo-account-list">
          {Object.entries(demoAccounts).map(([role, account]) => (
            <section className="demo-account" key={role} aria-label={`${role} demo account`}>
              <div>
                <span className="demo-account-role">{role}</span>
                <p><span>Email</span><code>{account.email}</code></p>
                <p><span>Password</span><code>{account.password}</code></p>
              </div>
              <button
                type="button"
                className="demo-account-use"
                onClick={() => handleUseDemoAccount(account)}
              >
                Use account
              </button>
            </section>
          ))}
        </div>
        <p className="demo-signins-note">Each browser stores its own accounts and tickets. Nothing syncs between users or devices; don’t enter sensitive data.</p>
      </aside>

      {sessionError && (
        <p className="login-error" role="alert">{sessionError}</p>
      )}

      <form className="login-form" onSubmit={handleSubmit}>
        <label className="login-field" htmlFor="login-email">
          <span>Email</span>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="login-field" htmlFor="login-password">
          <span>Password</span>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {submitError && (
          <p className="login-error" role="alert">{submitError}</p>
        )}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="login-register">
        New to WorkHelp? <Link to="/register">Create an employee account</Link>
      </p>
    </main>
  )
}
