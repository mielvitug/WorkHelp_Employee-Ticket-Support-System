# WorkHelp

Employee Ticket Support System built with React, JavaScript, Vite, React Router DOM,
and a local Express/SQLite API.

## Local setup

Install dependencies:

```sh
npm install
```

For a local demo, the API automatically seeds these shared accounts when it creates
a new database:

| Role | Email | Password |
|---|---|---|
| Employee | `mia.santos@example.com` | `DemoEmployee!2026` |
| Support | `alex.cruz@example.com` | `DemoSupport!2026` |

The development login page also shows these sign-ins and can fill them in for you.
They are for local demos only; do not use them with sensitive data or a hosted app.
The API does not use these defaults when `NODE_ENV=production`.

To use your own passwords instead, provide them in the API terminal before the
database is first initialized. Passwords must be at least 12 characters:

```powershell
$env:WORKHELP_EMPLOYEE_PASSWORD = Read-Host "Initial employee password"
$env:WORKHELP_SUPPORT_PASSWORD = Read-Host "Initial support password"
npm run dev:api
```

If either password is too short, the API startup error names the environment
variable and reports its character count without displaying the password.

Account passwords are used only when the database is first initialized. Existing
databases keep their current account passwords; demo credentials do not overwrite
them. Changing environment variables later also does not change an existing
account password. Do not commit personal passwords or reuse them elsewhere.

If this database was already initialized and you want to switch its seeded accounts
to the local demo passwords, stop the API and run:

```powershell
npm run reset:demo-accounts
```

This resets only the seeded Employee and Support passwords, signs those accounts
out, and preserves tickets. It is disabled when `NODE_ENV=production`.

In a second terminal, start the frontend:

```sh
npm run dev
```

Vite proxies `/api` requests to the API at `127.0.0.1:3001`. Ticket, account, and
session records are stored in the ignored `server/data/workhelp.sqlite` file.
Existing localStorage tickets are imported once, when an employee first loads
tickets after signing in; the local copy remains as a backup.

## Roles and sessions

- Employees can create and view their own tickets.
- Employees can read and reply to their own ticket conversations. Replies remain
  available after a ticket is closed.
- Support users can view all tickets, assign or unassign tickets to themselves,
  filter the list to tickets assigned to them, update ticket statuses, and reply
  to any ticket conversation.
- Registration and password reset are not implemented.
- Sessions are stored server-side in SQLite and use HttpOnly, SameSite=Strict cookies
  with a seven-day lifetime. Cookies are marked Secure when `NODE_ENV=production`.

This prototype has no public registration or production deployment setup. The API
binds to localhost and must not be exposed to an untrusted network. A public deployment
needs HTTPS, appropriate secure-cookie configuration, operational secret management,
and deployment/security review.

## Available scripts

- `npm run dev` starts the Vite frontend.
- `npm run dev:api` starts the local API and initializes the SQLite database/accounts.
- `npm run build` creates a production frontend build.
- `npm run preview` previews the production build.
- `npm run lint` runs Oxlint.
- `npm run test:api` runs backend and API-client integration tests.
