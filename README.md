# HomeShare AI

An intergenerational home-sharing platform: older adults with spare rooms (Hosts) are matched with trustworthy renters (Guests). Onboarding is done as a face-to-face video conversation with **Haven**, a Tavus-powered AI agent that asks about lifestyle, budget, and preferences and auto-populates the user's profile.

## Live deployment

| Service | URL |
| --- | --- |
| Frontend | https://homeshare-ai.vercel.app |
| Backend  | https://homeshare-ai-backend.vercel.app |
| Database | Supabase (project `xmmlbshcutsrpkwlunvc`) |

Both the frontend and backend are deployed as separate Vercel projects from this same repo, configured with `Root Directory = frontend` and `Root Directory = backend` respectively. Pushes to `main` trigger auto-deploys.

## Tech stack

- **Frontend:** React 18, Vite, TailwindCSS, React Router v6, Zustand, axios
- **Backend:** Node 18+, Express 4, JWT auth, raw `pg` driver (no ORM)
- **Database:** Postgres (Supabase in prod, local Postgres or Supabase in dev)
- **AI Video:** Tavus CVI — persona `p8a304e4f7f9` ("Haven"), replica `r38172bb38dc`
- **Hosting:** Vercel serverless (both projects)

## Local dev — quick start

```bash
git clone https://github.com/sjjobr/homeshare-ai.git
cd homeshare-ai

# Install deps
cd backend  && npm install
cd ../frontend && npm install

# Backend env
cp ../backend/.env.example ../backend/.env
# Then edit backend/.env and fill in the variables below
```

**Choose one for the database:**

- **Easy: point at Supabase (same DB as prod).** In `backend/.env`, set `DATABASE_URL` to your Supabase pooler URI (Project Settings → Database → Connection string → URI, *Session pooler* on port 5432). The `pg` pool auto-enables SSL for non-localhost hosts.
- **Local Postgres:** `brew install postgresql@16 && brew services start postgresql@16`, then:
  ```bash
  psql -d postgres -c "CREATE DATABASE homeshare;"
  psql -d homeshare -f backend/src/db/schema.sql
  ```
  In `backend/.env`, set `DATABASE_URL=postgresql://$(whoami)@localhost:5432/homeshare`.

**Run the dev servers** (two terminals):

```bash
# terminal 1
cd backend  && npm run dev   # → http://localhost:4000

# terminal 2
cd frontend && npm run dev   # → http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend, so you don't need `VITE_API_URL` set locally.

## Environment variables

### `backend/.env`

| Name | Required | Notes |
| --- | :---: | --- |
| `DATABASE_URL` | yes | Postgres connection URI. URL-encode special chars in the password. |
| `JWT_SECRET` | yes | Random 32+ byte hex string. `openssl rand -hex 32` generates one. |
| `TAVUS_API_KEY` | yes | From https://platform.tavus.io → API Keys. |
| `TAVUS_PERSONA_ID` | yes | The Haven persona — `p8a304e4f7f9`. |
| `TAVUS_REPLICA_ID` | yes | `r38172bb38dc`. |
| `FRONTEND_URL` | yes (prod) | Used by CORS. Local dev defaults to `http://localhost:5173`. |
| `APP_BASE_URL` | yes (prod) | Used to construct the Tavus webhook callback URL. Local dev defaults to `http://localhost:4000`. |
| `TAVUS_WEBHOOK_SECRET` | recommended | HMAC secret. **If unset, the webhook accepts unsigned requests** — fine for dev, risky in prod. |
| `PORT` | no | Defaults to 4000. Vercel sets this automatically. |
| `AWS_*`, `STRIPE_*`, `RESEND_*` | no | Placeholders for future S3 photo uploads / payments / email. Not yet wired up. |

### Vercel frontend project

| Name | Value |
| --- | --- |
| `VITE_API_URL` | `https://homeshare-ai-backend.vercel.app/api` |

`VITE_*` vars are baked into the bundle at build time and visible to anyone. Never put secrets here.

## Project structure

```
backend/
  api/index.js              ← Vercel serverless entry; wraps src/server.js
  src/
    server.js               ← Express app (skips listen() when running on Vercel)
    db/
      pool.js               ← pg.Pool with auto-SSL for non-localhost
      schema.sql
    middleware/auth.js      ← JWT verification middleware
    routes/
      auth.js               ← /api/auth/register, /login
      users.js              ← /api/users/me (GET, PATCH), /:id
      listings.js
      matches.js
      appointments.js
      messages.js
      tavus.js              ← /api/tavus/conversation, /webhook
    services/
      tavusService.js       ← Tavus CVI API wrapper + Haven system prompt
      matchingService.js    ← Compatibility scoring
  vercel.json               ← Routes all traffic to api/index.js

frontend/
  index.html
  src/
    main.jsx, App.jsx
    api/client.js           ← axios instance, attaches JWT from Zustand
    store/appStore.js       ← Zustand (persisted to localStorage)
    pages/
      LoginPage, RegisterPage, OnboardingPage, DashboardPage,
      ListingsPage, MatchesPage, MessagesPage, AppointmentsPage
    components/TavusVideoAgent.jsx   ← Tavus iframe (mobile-first)
  vite.config.js            ← /api dev proxy → localhost:4000
  tailwind.config.js
```

## Tavus AI onboarding flow

1. User registers → picks Host or Guest role
2. Frontend hits `POST /api/tavus/conversation` → backend creates a Tavus CVI session with a system prompt built from `tavusService.js` (`buildSystemPrompt`)
3. The Tavus iframe loads in the browser; Haven asks the role-specific topics in order, exactly once each
4. When the call ends, Tavus POSTs the transcript to `/api/tavus/webhook?user_id=<uuid>` (encoded as a query param because Tavus removed the `webhook_user_id` field)
5. The webhook handler extracts structured profile data (budget, lifestyle tags, helper-exchange flag), writes it to `users`, and runs `matchingService.generateMatchesForUser`
6. User is redirected to `/matches`

The webhook URL is `${APP_BASE_URL}/api/tavus/webhook` — so `APP_BASE_URL` *must* point at the publicly-reachable backend in production.

## API surface

```
POST  /api/auth/register
POST  /api/auth/login
GET   /api/auth/me

GET   /api/users/me                    Own profile (camelCase)
PATCH /api/users/me                    Partial update (role, onboardingCompleted, etc.)
GET   /api/users/:id                   Public profile (UUID required)

GET   /api/listings                    Browse with filters
POST  /api/listings                    Create (Host only)
GET   /api/listings/:id

GET   /api/matches
POST  /api/matches/:id/like

GET   /api/appointments
POST  /api/appointments

GET   /api/messages/:matchId
POST  /api/messages/:matchId

POST  /api/tavus/conversation          Start a CVI session
POST  /api/tavus/webhook               Receives transcript from Tavus (server-to-server)

GET   /health                          Liveness probe
```

All `/api/*` routes except `register`, `login`, and `tavus/webhook` require a `Authorization: Bearer <jwt>` header.

## Known gaps

- `TAVUS_WEBHOOK_SECRET` is not set in production. Anyone who finds the webhook URL could POST fake transcripts. Generate a secret in the Tavus dashboard, add to backend env, redeploy.
- `express-rate-limit` uses in-memory storage which doesn't span Vercel serverless instances; rate limiting is effectively per-instance. Move to a Redis-backed store before exposing publicly at scale.
- S3 photo upload, Stripe payments, Resend email, and DocuSign lease signing are stubbed (env vars present) but not implemented.
- `docker-compose.yml` still exists from the original scaffold; it's not used since the move to Supabase + Vercel.

## License

MIT.
