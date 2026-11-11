# WorkHelp

Employee Ticket Support System built with React, JavaScript, Vite, and React Router
DOM. The deployed frontend stores its demo accounts, tickets, and replies in the
current browser; it does not connect to a hosted API or shared database.

## Run and deploy

Install dependencies:

```sh
npm install
```

Start the frontend locally:

```sh
npm run dev
```

The Vercel project can use the Vite preset, build command `npm run build`, and
output directory `dist`. No API URL or Vercel environment variable is needed for
this browser-local demo.

Each browser starts with these demo accounts:

| Role | Email | Password |
|---|---|---|
| Employee | `mia.santos@example.com` | `DemoEmployee!2026` |
| Support | `alex.cruz@example.com` | `DemoSupport!2026` |

## Roles and sessions

- Employees can register in a browser, create and view their own tickets, reply to
  their conversations, and change their password.
- Support can view all tickets created in that same browser, assign tickets,
  update statuses, reply, and archive or restore tickets.
- Tickets and replies are kept in that browser's local storage and survive reloads.
  They do not sync to another browser, device, or person. To demonstrate both roles
  against the same tickets, sign out and switch roles in the same browser.
- Clearing site data removes that browser's accounts, tickets, and replies.
- This is a demo, not secure account storage: anyone with access to the browser can
  inspect or modify its data. Do not enter sensitive or real employee information.
- Email verification and password recovery are not available.

## Available scripts

- `npm run dev` starts the Vite frontend.
- `npm run build` creates a production frontend build.
- `npm run preview` previews the production build.
- `npm run lint` runs Oxlint.
- `npm run test:api` runs API and browser-storage tests.
