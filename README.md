# MaidCare

Internal web app for managing a cleaning business's customers: who they are,
where we clean, their service plans, visits and payments. It holds sensitive
customer information, so every page requires signing in, and accounts can only
be created by an admin.

## Features

### Sign-in
- Email and password sign-in at `/login`. There is no public sign-up page.
- Sessions last 14 days. **Sign out** is in the header.
- After 5 failed attempts for an email (or 20 from one IP), sign-in is
  blocked for 15 minutes.
- Admins manage accounts from the terminal (see [Managing users](#managing-users)).
  Disabling someone or resetting their password signs them out everywhere
  immediately.

### Customers (`/customers`)
- **List** of all customers, sortable by code, name, type, status, email or
  date added.
- **Search** across customer code, name, company and email, plus contact
  names, contact emails, phone numbers (any formatting) and property addresses.
  The search and sort stay in the URL, so results can be bookmarked.
- **Customer page** showing their details, billing address, who referred them
  and who they referred, plus their contacts, properties with current service
  plans, the 10 most recent visits and the 10 most recent payments with a
  total paid.
- **Add and edit** customers. Edits show a summary of what changed and
  ask for confirmation before saving.
- **Billing address**: one of the customer's own properties. A new customer's
  first property (entered on the add-customer form, optional) becomes their
  billing address; change it from the edit form.
- **Add contacts** from the customer page. Phone numbers are stored as
  +1XXXXXXXXXX and shown as (410) 555-1234. Marking a new contact as primary
  replaces the current primary contact.
- Customer **status**: lead, active, paused or inactive. Marking a customer
  inactive requires an end date and at least one reason for leaving.

### Properties (`/properties`)
- **List** of every property with its customer, zone, current service plan
  and status. Search by address, ZIP, or customer name or code.
- **Add a property** to any customer, from the list or from a customer's
  page. If the customer has no billing address yet, it becomes it; tick
  "Use as the customer's billing address" to switch it anyway.
- **Edit a property**: address, zone, crew access and service notes, active
  status, billing address, or move it to a different customer.

### Appointments (`/appointments`)
- **Week view**, Monday to Sunday, with each day's appointments, the vehicle,
  price and status, and how many are booked. Switch between **day, week and
  month** views (the last one used is remembered in each browser), step
  between periods, jump to any date or month with **Go to**, or add an
  appointment on a given day. Dates in the week and month views open that day.
- **Book an appointment** for a customer at one of their properties, with a
  date, start and end time (Eastern), vehicle, price and notes. The property
  defaults to the billing address and the price to its service plan rate.
- **Statuses**: pending, completed or canceled. Canceling keeps the
  appointment on record and frees its vehicle; it can be reopened.
- **A vehicle can't be double-booked**: overlapping appointments for the same
  vehicle are refused (canceled ones don't count), naming the clash.
- **History**: every change records who made it, when, and what changed
  (e.g. "Price: $175.00 → $160.00"). Created/modified by and when are under
  System Information.
- An appointment stays with the customer it was booked for. If its property
  is transferred, pending appointments move to the new owner; completed and
  canceled ones stay.
- Customer pages list their appointments and have a "New appointment" button.

### Vehicles (`/vehicles`)
- Add and edit company vehicles: name, license plate and GPS tracker name.
  Taking one out of service hides it from new bookings without touching
  existing ones.

### Not built yet
- **Invoices**: appointments show a placeholder. The plan is `invoices` plus
  `invoice_lines` (one line per billed appointment), with payments moving from
  appointments to invoices.
- **Generating appointments from service plans** ahead of time.

## Security

- Passwords are hashed with scrypt. Session cookies are `httpOnly`, `Secure`
  in production and `SameSite=Lax`, and only a hash of each session token is
  stored in the database.
- Writes to audited tables (appointments) run in a `db.batch()` that starts
  with `asUser(user.id)` (`lib/db-helpers.ts`), so the database triggers record
  who made the change. Changes made outside the app are logged with no user.
- Every data read and save action checks the session against the database
  (`requireUser()` in `lib/auth/session.ts`). **Any new page or action that
  touches customer data must call it.** `proxy.ts` only redirects visitors
  with no session cookie to `/login`.
- Security headers (CSP, HSTS, framing protection and others) are set in
  `next.config.ts`. A new third-party script or service (maps, Stripe, etc.)
  must be added to the CSP there or the browser will block it.
- The app must be served over HTTPS in production.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components) with React 19
- [Neon](https://neon.tech) Postgres via [Drizzle ORM](https://orm.drizzle.team)
- [shadcn/ui](https://ui.shadcn.com) components on Base UI, styled with Tailwind CSS 4

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with the Neon connection strings:
   ```
   DATABASE_URL=postgres://...          # pooled, used by the app
   DATABASE_URL_UNPOOLED=postgres://... # direct, used by drizzle-kit
   ```
3. Create your account:
   ```bash
   npm run users -- add you@example.com Your Name
   ```
4. Start the dev server and open [http://localhost:3000](http://localhost:3000):
   ```bash
   npm run dev
   ```

## Managing users

```bash
npm run users -- list                    # all accounts
npm run users -- add <email> <name>      # create an account (prompts for a password)
npm run users -- passwd <email>          # set a new password and sign them out
npm run users -- disable <email>         # block sign-in and sign them out
npm run users -- enable <email>          # allow sign-in again
npm run users -- signout <email>         # end all their sessions
```

Passwords must be at least 12 characters.

These use the database in `.env.local`. To manage production accounts, put the
production connection string in front of the command (it takes precedence over
`.env.local`):

```bash
DATABASE_URL='postgres://...' npm run users -- add you@example.com Your Name
```

## Database changes

The schema is defined in `db/schema.ts` and migrations live in `drizzle/`.

1. Edit `db/schema.ts`.
2. Generate a migration: `npx drizzle-kit generate --name <description>`.
   Review the SQL, and hand-edit it when drizzle-kit can't express the change
   (see `drizzle/0001_inactive_status.sql`).
3. Apply it to the dev database: `npm run db:migrate`.
4. Commit the migration with the code that needs it and push to `main`.

**Production is migrated automatically.** Every Vercel production deploy runs
`npm run vercel-build`, which applies any new migrations to the production
database (using its `DATABASE_URL`) before building. Migrations run in one
transaction, so if one fails, nothing is applied and the deploy stops with the
old version still live. Preview deploys don't run migrations.

A few rules follow from that:
- Never edit a migration that has already been pushed; add a new one instead.
- Don't change the database by hand (Neon console, SQL editor). Make every
  change through a migration, or the two databases will drift apart.
- Migrations run before the new code goes live, so keep them compatible with
  the version currently running: add columns and tables first, and remove old
  ones in a later deploy.
- Use `npm run db:migrate`, not `drizzle-kit migrate`. The script also
  recognizes migrations 0000–0002, which were applied by hand before tracking
  began.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm run db:migrate` | Apply new migrations to the database in `.env.local` |
| `npm run vercel-build` | Migrate, then build (what Vercel runs in production) |
| `npm run users -- <command>` | Manage staff accounts |
