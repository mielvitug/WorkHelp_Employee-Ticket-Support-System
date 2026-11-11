import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth'
import './AppLayout.css'

const navClass = ({ isActive }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link'

export function AppLayout() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [logoutError, setLogoutError] = useState('')

    const handleLogout = async () => {
        setLogoutError('')
        try {
            await logout()
            navigate('/login', { replace: true })
        } catch (error) {
            setLogoutError(error.message)
        }
    }

    return(
    <div className="layout">
        <header className="site-header">
            <div className="site-header-inner">
                <NavLink to="/dashboard" className="brand" aria-label="WorkHelp home">
                    <span className="brand-mark" aria-hidden="true">w</span>
                    <span className="brand-name">workhelp<span className="brand-period">.</span></span>
                </NavLink>
                <nav className="main-nav">
                    <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
                    <NavLink to="/tickets" className={navClass}>Tickets</NavLink>
                </nav>
                <div className="account-nav">
                    <div className="account-identity">
                        <span className="account-avatar" aria-hidden="true">{user.name.charAt(0)}</span>
                        <span className="account-label">
                            <strong>{user.name}</strong>
                            <span className="account-role">{user.role}</span>
                        </span>
                    </div>
                    <button className="logout-button" type="button" onClick={handleLogout}>Sign out</button>
                </div>
            </div>
        </header>
        {logoutError && <p className="layout-error" role="alert">{logoutError}</p>}
        <main className="site-main">
            <Outlet />
        </main>
    </div>
    )
}