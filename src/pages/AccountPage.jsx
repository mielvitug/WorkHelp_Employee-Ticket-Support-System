import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import './AuthForms.css'

const minPasswordLength = 12
const maxPasswordLength = 35

export function AccountPage() {
  const { user, changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password updated for this browser.')
    } catch (changeError) {
      setError(changeError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="account-page account-settings">
      <p className="page-eyebrow">Your profile</p>
      <h1 className="page-title">Account settings</h1>
      <p className="page-subtitle">Manage your sign-in details.</p>

      <section className="account-profile" aria-labelledby="account-profile-heading">
        <h2 id="account-profile-heading">Account</h2>
        <dl className="account-profile-details">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd className="account-role-value">{user.role}</dd>
          </div>
        </dl>
      </section>

      <form className="account-form" onSubmit={handleSubmit}>
        <div className="account-form-heading">
          <h2>Change password</h2>
          <p>Enter your current password to confirm it’s you.</p>
        </div>

        <label className="account-field" htmlFor="current-password">
          <span>Current password</span>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>

        <label className="account-field" htmlFor="new-password">
          <span>New password</span>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={minPasswordLength}
            maxLength={maxPasswordLength}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>

        <label className="account-field" htmlFor="confirm-new-password">
          <span>Confirm new password</span>
          <input
            id="confirm-new-password"
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

        {error && <p className="account-message account-error" role="alert">{error}</p>}
        {success && <p className="account-message account-success" role="status">{success}</p>}

        <button className="account-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Updating password...' : 'Update password'}
        </button>
      </form>
    </section>
  )
}
