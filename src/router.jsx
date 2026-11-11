import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { TicketsPage } from './pages/TicketsPage'
import { NewTicketPage } from './pages/NewTicketPage'
import { TicketDetailPage } from './pages/TicketDetailPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AccountPage } from './pages/AccountPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProtectedRoute } from './components/auth/ProtectedRoute'


export const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    { path: '/register', element: <RegisterPage /> },
    {
        path: '/',
        element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
        children: [
            { index: true, element: <Navigate to="/dashboard" replace /> },
            { path: 'dashboard', element: <DashboardPage /> },
            { path: 'account', element: <AccountPage /> },
            { path: 'tickets/new', element: <ProtectedRoute allowedRole="employee"><NewTicketPage /></ProtectedRoute> },
            { path: 'tickets/:ticketId', element: <TicketDetailPage /> },
            { path: 'tickets', element: <TicketsPage /> },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
])