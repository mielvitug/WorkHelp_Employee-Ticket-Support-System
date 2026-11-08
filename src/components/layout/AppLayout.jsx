import { NavLink, Outlet } from "react-router-dom";
import './AppLayout.css'

const navClass = ({ isActive }) =>
    isActive ? 'nav-link nav-link-active' : 'nav-link'

export function AppLayout() {
    return(
    <div className="layout">
        <header className="site-header">
            <div className="site-header-inner">
                <NavLink to="/dashboard" className="brand">WorkHelp</NavLink>
                <nav className="main-nav">
                    <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
                    <NavLink to="/tickets" className={navClass}>Tickets</NavLink>
                </nav>
            </div>
        </header>
        <main className="site-main">
            <Outlet />
        </main>
    </div>
    )
}