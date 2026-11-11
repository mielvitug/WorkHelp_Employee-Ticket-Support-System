import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

export function ProtectedRoute({ allowedRole, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="page-subtitle" role="status">Checking your sign-in...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
