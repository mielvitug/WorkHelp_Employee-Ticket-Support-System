import { Link } from 'react-router-dom'

export function NotFoundPage() {
    return(
        <section>
            <h1 className="page-title">Page not found</h1>
            <p className="page-subtitle">That page does not exist.</p>
            <Link className="text-link" to="/dashboard">Back to dashboard</Link>
        </section>
    )
}