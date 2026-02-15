# Ezyy Inventory

Device inventory, client and subscription management, invoicing, and provider billing for Ezyy.

## Prerequisites

- **Node.js** (v20+)
- **Supabase CLI** (optional, for local Supabase and migrations)

## Quick start

### 1. Web app

```bash
cd web-app
cp .env.example .env
# Edit .env and set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY
npm install
npm run dev
```

### 2. Supabase (backend)

- Create a project at [supabase.com](https://supabase.com) or run Supabase locally with the CLI.
- Apply migrations from `supabase/migrations/` in order (via Dashboard SQL editor or `supabase db push`).
- Copy `supabase/.env.example` to `supabase/.env` and set `RESEND_API_KEY` (and optionally `FRONTEND_URL`) for the send-invoice-email function.

## Scheduled period invoices

To run period invoice generation daily (e.g. create draft invoices for subscriptions due), call the Edge Function `generate-period-invoices` on a schedule:

- **URL:** `POST https://<project-ref>.supabase.co/functions/v1/generate-period-invoices`
- **Auth:** If `CRON_SECRET` is set in Supabase secrets, send header `x-cron-secret: <value>`. Otherwise the function allows unauthenticated POST (suitable only for local or if you protect the URL another way).
- **Example (cron):** `0 6 * * * curl -s -X POST -H "x-cron-secret: $CRON_SECRET" "https://<project-ref>.supabase.co/functions/v1/generate-period-invoices"`
- **Alternative:** Enable the `pg_cron` extension in Supabase and schedule `SELECT generate_period_invoices();` daily from the SQL editor or a migration.

## Notifications (alerts)

The in-app bell shows notifications for overdue invoices, renewals, subscriptions ending soon, and devices in maintenance. To populate notifications for all users, run the database function periodically (e.g. daily):

- **From SQL (Dashboard or pg_cron):** `SELECT sync_notifications_from_alerts();`
- This function inserts one unread notification per (user, alert type, entity); it skips creating duplicates. Only roles that can see the Alerts page (super_admin, admin, front_desk, viewer) receive notifications.

## Environment variables

| Where        | Variable                               | Description |
|-------------|----------------------------------------|-------------|
| web-app     | `VITE_SUPABASE_URL`                    | Supabase project URL |
| web-app     | `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`| Supabase anon/public key |
| supabase    | `RESEND_API_KEY`                       | Resend API key for invoice emails |
| supabase    | `FRONTEND_URL`                         | Optional; frontend origin for edge function CORS |
| supabase    | `CRON_SECRET`                          | Optional; secret for generate-period-invoices (header x-cron-secret) |

See `web-app/.env.example` and `supabase/.env.example` for templates.

## Deploying to Netlify

The repo is configured for Netlify via `netlify.toml` at the root:

- **Build:** runs from `web-app` (`npm run build`), publishes `web-app/dist`.
- **SPA:** all routes redirect to `index.html` so React Router works.

**Steps:**

1. In [Netlify](https://app.netlify.com), add a new site and connect this repository.
2. Netlify will use the existing `netlify.toml` (no need to set base directory or build command manually).
3. In **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — your Supabase anon/public key
4. Trigger a deploy (or push to your connected branch).

In Supabase, add your Netlify site URL to **Authentication → URL configuration → Redirect URLs** if you use email magic links or OAuth.

## Scripts

- **web-app:** `npm run dev` (dev server), `npm run build`, `npm run preview`, `npm run lint`
- **Tests:** from `web-app`, `npm test` (Vitest; client validation tests)

## Roles and permissions

The app uses role-based access (aligned with Supabase RLS):

- **Super Admin:** Full access; can manage user roles in Settings.
- **Admin:** Same as Super Admin for most resources.
- **Front desk:** Clients, subscriptions, plans, invoices, providers, provider payments, imports, reports.
- **Technician:** Devices and assignments.

Assign roles in the `profiles` table (or via Settings if you are a Super Admin).
