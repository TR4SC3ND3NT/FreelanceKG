# freelancekg

<p align="left">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19-61dafb?logo=react&logoColor=white" alt="react"></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/vite-7-646cff?logo=vite&logoColor=white" alt="vite"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-5-3178c6?logo=typescript&logoColor=white" alt="typescript"></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/tailwind_css-4-06b6d4?logo=tailwindcss&logoColor=white" alt="tailwind css"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node.js-20-339933?logo=nodedotjs&logoColor=white" alt="node"></a>
  <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/express-4-black?logo=express&logoColor=white" alt="express"></a>
  <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/prisma-5-2d3748?logo=prisma&logoColor=white" alt="prisma"></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-15-4169e1?logo=postgresql&logoColor=white" alt="postgresql"></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/redis-7-dc382d?logo=redis&logoColor=white" alt="redis"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/socket.io-4-010101?logo=socketdotio&logoColor=white" alt="socket.io"></a>
  <a href="https://www.i18next.com/"><img src="https://img.shields.io/badge/i18next-24-26a69a?logo=i18next&logoColor=white" alt="i18next"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/docker-compose-2496ed?logo=docker&logoColor=white" alt="docker"></a>
</p>

freelancekg is a marketplace platform for clients and freelancers with secure deal flow, realtime communication, and an operational admin layer.

the project is focused on practical production patterns: auth + permissions, escrow-like payments, disputes, audit trail, feature flags, and dockerized local setup.

current runtime is a react + vite spa frontend with an express backend.

## table of contents

- [features](#features)
- [project structure](#project-structure)
- [tech stack](#tech-stack)
- [architecture at a glance](#architecture-at-a-glance)
- [key api surface](#key-api-surface)
- [key frontend routes](#key-frontend-routes)
- [quick start (docker)](#quick-start-docker)
- [environment variables](#environment-variables)
- [database](#database)
- [render deployment](#render-deployment)
- [scripts and commands](#scripts-and-commands)
- [troubleshooting](#troubleshooting)
- [security notes](#security-notes)
- [roadmap](#roadmap)
- [business plan (for diploma)](#business-plan-for-diploma)

## features

### implemented now

- authentication and identity:
  - jwt auth, session invalidation, oauth (google/github), password reset, profile/account settings
- role and access model:
  - roles (`client`, `freelancer`, `admin`) + permission guards + feature flags API
- marketplace core:
  - freelancer catalog, profile pages, order lifecycle, proposals (bids)
- work execution:
  - order messaging, file attachments, notifications, telegram linking and alerts
- finance and trust:
  - escrow-like flow, payment intents, withdrawal requests, disputes with evidence and resolution
- enterprise operations layer:
  - audit log, ledger entries, idempotency keys, support cases, admin finance/dispute tools
- product UI foundation:
  - dashboard pages for client/freelancer/admin, reusable ui-kit, i18n (`ru`, `en`, `ky`)

### planned

- real payment provider hardening for production rollout
- expanded verification and anti-fraud scoring
- richer search/recommendation ranking
- deeper analytics dashboards for growth and retention

## project structure

```text
freelancekg/
├── src/                        # frontend (react + vite)
│   ├── pages/                  # public and dashboard pages
│   ├── components/             # ui-kit, layout, dashboard widgets
│   ├── context/                # auth, theme, language contexts
│   ├── services/               # api client + socket client
│   └── i18n/                   # localization resources (ru/en/ky)
├── server/
│   ├── src/
│   │   ├── routes/             # auth, orders, payments, disputes, admin, workflow, cases
│   │   ├── middleware/         # auth, role/permission guards
│   │   ├── lib/                # prisma, payment domain, telegram, logger, ledger, idempotency
│   │   └── config/             # environment validation
│   ├── prisma/
│   │   ├── schema.prisma       # core data model
│   │   └── migrations/         # database migrations (tracked in git)
│   └── tests/integration/      # critical backend integration tests
├── docker-compose.yml          # local infrastructure and app services
├── scripts/                    # local smoke checks and db helper
├── nginx/                      # frontend web server config
└── docs/                       # operational and enterprise documentation
```

## tech stack

### frontend

- react 19 + typescript
- vite 7
- react router
- tailwind css
- i18next
- socket.io client

### backend

- node.js + express + typescript
- prisma orm
- zod validation
- socket.io
- passport oauth + jwt auth
- winston logging

### data and infrastructure

- postgresql 15 (docker compose service)
- redis 7 (docker compose service)
- mailpit (local smtp inbox)
- adminer (optional dev profile)
- docker compose for local orchestration

## architecture at a glance

- frontend:
  - react 19 + vite single-page app
  - public marketing pages + authenticated dashboards
  - shared api client in `src/services/api.ts`
- backend:
  - express api mounted under `/api`
  - prisma + postgresql for persistent data
  - socket.io for realtime messaging/notifications
  - zod validation + role/permission guards for protected actions
- business modules:
  - auth and profile management
  - freelancer catalog and profile pages
  - orders, proposals, submissions, approvals
  - payments, disputes, uploads, notifications
  - admin operations, audit log, ledger, feature flags
  - workspace module for profile, security, documents, subscription, team, verification

## key api surface

base url:

- local: `http://localhost:3001/api`
- render: `${VITE_API_ORIGIN}/api`

main api groups mounted in the server:

- `/api/auth`
  - registration, login, logout, current user, profile/settings, sessions, password reset, oauth, telegram link
- `/api/freelancers`
  - freelancer list, public profile, reviews, availability, freelancer profile updates
- `/api/orders`
  - order creation, order list/detail, proposals, accept/reject, submit work, approve, reject, cancel, review
- `/api/messages`
  - conversation history, send message, mark read, unread counters, conversation list
- `/api/disputes`
  - create dispute, dispute list/detail, responses, evidence upload, admin resolution
- `/api/payments`
  - payment config, payment methods, escrow flow, balance, withdrawals, transactions, client/freelancer stats
- `/api/uploads`
  - single upload, multi-upload, avatar upload, delete uploaded file, upload config
- `/api/notifications`
  - list, unread count, mark read, mark all read, delete one, delete all
- `/api/admin`
  - platform stats, users management, orders moderation, disputes resolution, audit logs, ledger, ledger summary
- `/api/platform`
  - feature flags read/update
- `/api/workflow`
  - milestones and change requests for order execution
- `/api/cases`
  - support case creation, queue, assignment, status changes
- `/api/workspace`
  - overview, activity log, team, security, verification, subscription, payment methods, documents, client profile, resume

health and discovery endpoints:

- `/health`
- `/api/health`
- `/api`

## key frontend routes

public pages:

- `/`
- `/freelancers`
- `/freelancers/:id`
- `/categories`
- `/how-it-works`
- `/about`
- `/contact`
- `/faq`
- `/blog`
- `/terms`
- `/login`
- `/register`

authenticated product routes:

- `/dashboard`
- `/dashboard/orders`
- `/dashboard/messages`
- `/dashboard/notifications`
- `/dashboard/settings`
- `/dashboard/documents`
- `/client/orders`
- `/client/finance`
- `/client/profile`
- `/freelancer/orders`
- `/freelancer/market`
- `/freelancer/finance`
- `/freelancer/resume`
- `/admin`
- `/workspace/*`

## quick start (docker)

1. clone the repository:

```bash
git clone https://github.com/TR4SC3ND3NT/FreelanceKG.git
cd FreelanceKG
```

2. create runtime env from template:

```bash
cp .env.example .env
```

3. start infrastructure and app containers:

```bash
docker compose up -d --build
```

4. verify service health:

```bash
docker compose ps
docker compose logs -f backend frontend
```

5. optional dev utilities:

```bash
docker compose --profile dev up -d adminer
```

### local run without docker

```bash
cp server/.env.example server/.env
npm install
cd server && npm install
cd server && npx prisma generate && npx prisma migrate dev && npm run db:seed
```

run app in two terminals:

```bash
# terminal 1
cd server
npm run dev

# terminal 2
npm run dev
```

### default urls

- frontend: `http://localhost`
- backend api: `http://localhost:3001/api`
- backend health: `http://localhost:3001/health`
- mailpit: `http://localhost:8025`
- adminer (dev profile): `http://localhost:8080`

## environment variables

use templates only:

- root compose/runtime variables: `.env.example`
- backend local variables: `server/.env.example`

real `.env` files are intentionally not committed. this is correct for render and github:

- render reads env vars from `render.yaml` and from the render dashboard/service settings
- the repository should keep only templates, not live secrets
- first deploy works from the committed blueprint without pushing real `.env` files into git
- manual env setup is only needed later for optional integrations such as oauth, smtp, telegram, or s3 storage

### key variables map

| variable | where used | purpose |
|---|---|---|
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | docker compose | postgres bootstrap |
| `REDIS_PASSWORD` | docker compose | redis auth |
| `JWT_SECRET`, `SESSION_SECRET` | backend | auth/session signing |
| `DATABASE_URL` | backend prisma | database connection |
| `REDIS_URL` | backend | redis connection |
| `PAYMENT_PROVIDER` | backend | payment mode (`mock`, `paybox`, `disabled`) |
| `ENABLE_OAUTH`, `DEV_OAUTH_MOCK` | backend | oauth toggles |
| `VITE_API_ORIGIN`, `VITE_API_URL`, `VITE_SOCKET_URL` | frontend | api/socket endpoints |

## database

- schema source of truth: `server/prisma/schema.prisma`
- migrations path: `server/prisma/migrations/*/migration.sql`
- backend container applies migrations on startup:
  - `npx prisma migrate deploy && node dist/index.js`

manual docker commands:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run db:seed
```

helper script:

```bash
./scripts/docker-db-setup.sh
```

this flow initializes a clean database from migrations and optional seed data. no local data dumps are required.

## render deployment

- blueprint file: `render.yaml`
- render-specific notes: `docs/render-free-deploy.md`

the blueprint creates:

- a static frontend service
- a node backend service
- a render postgresql database

for first deploy it uses conservative defaults:

- oauth disabled
- payments disabled
- telegram polling disabled
- local file storage

this makes the app boot cleanly on render without extra paid infrastructure. if you need durable uploads, switch storage to s3-compatible object storage before production use.

render env behavior:

- `DATABASE_URL` is wired from the render postgres service
- `JWT_SECRET`, `SESSION_SECRET`, and `TELEGRAM_LINK_SECRET` are generated automatically
- `CORS_ORIGIN` and `FRONTEND_URL` are wired from the frontend service url
- `VITE_API_ORIGIN` and `VITE_SOCKET_URL` are wired from the backend service url
- no committed production `.env` file is required for the first deploy

## scripts and commands

### root scripts

| command | action |
|---|---|
| `npm run dev` | run vite frontend |
| `npm run build` | build frontend |
| `npm run preview` | preview frontend build |
| `npm run local:start` | start local app via shell script |
| `npm run local:stop` | stop local app via shell script |
| `npm run local:smoke` | run local smoke checks |

### server scripts

| command | action |
|---|---|
| `npm run dev` | run backend in watch mode |
| `npm run build` | compile backend typescript |
| `npm run start` | start compiled backend |
| `npm run db:generate` | generate prisma client |
| `npm run db:migrate` | run prisma migrate dev |
| `npm run db:migrate:prod` | run prisma migrate deploy |
| `npm run db:seed` | seed development data |
| `npm run db:studio` | open prisma studio |
| `npm run test:integration` | run integration tests |

## troubleshooting

- backend exits during startup:
  - `docker compose logs backend`
- migration errors:
  - `docker compose exec backend printenv DATABASE_URL`
  - `docker compose exec backend npx prisma migrate deploy`
- frontend cannot reach api:
  - verify `CORS_ORIGIN`, `FRONTEND_URL`, `VITE_API_ORIGIN`, `VITE_API_URL`
- occupied ports:
  - check `80`, `3001`, `5432`, `6379`, `1025`, `8025`

## security notes

- do not commit `.env` or `server/.env`
- do not commit key/cert/dump/runtime db files
- runtime folders (`node_modules`, `dist`, logs, container data) are ignored
- migrations are intentionally tracked

pre-push check:

```bash
git ls-files \
  | grep -E '(^|/)\\.env(\\.|$)|\\.pem$|\\.key$|\\.p12$|\\.pfx$|id_rsa|\\.crt$|\\.dump$|\\.bak$|\\.db$|\\.sqlite' \
  | grep -Ev '(^|/)\\.env\\.example$|(^|/)\\.env\\.template$|^server/prisma/migrations/.+/migration\\.sql$' || true
```

expected result: empty output.

## roadmap

- finalize production payment provider integration
- add richer moderation and verification pipeline
- expand analytics and operational dashboards
- improve recommendation quality for freelancer discovery
- add stronger anti-fraud/risk scoring workflow

## business plan (for diploma)

### 1) problem and solution

**problem**

- fragmented freelance market with low trust and weak execution control
- direct deals without protected payment flow increase fraud risk
- poor dispute handling and no transparent delivery history

**solution**

- a structured marketplace where client and freelancer interact in one workflow:
  - order lifecycle
  - proposal and selection
  - messaging and file exchange
  - dispute handling and resolution
  - escrow-like payment control and admin audit layer

### 2) target audience

- clients:
  - small businesses
  - startups
  - individual customers
- freelancers:
  - developers
  - designers
  - digital specialists (content, smm, etc.)
- initial geography:
  - kyrgyzstan
- expansion direction:
  - regional cis market (planned)

### 3) value proposition

**for clients**

- transparent execution flow and delivery checkpoints
- safer payment process with dispute path
- centralized communication and project history

**for freelancers**

- stable lead channel through marketplace orders
- profile and reputation growth through completed projects and reviews
- structured payout and transaction visibility

### 4) competitive analysis

- global platforms (upwork, fiverr):
  - high competition, less local adaptation
- local informal channels (chats/groups):
  - low process discipline, weak trust guarantees

**project edge**

- local market focus and language support
- integrated admin operations (cases, audit, ledger visibility)
- configurable platform logic via feature flags and role permissions

### 5) monetization

- core commission from successfully completed orders (take rate model)
- paid visibility tools for freelancers (planned)
- fee layer around payout/payment operations (planned and provider-dependent)
- b2b package model for company accounts (planned)

### 6) go-to-market

- launch channels:
  - university and course communities
  - targeted social media campaigns
  - referral mechanics for early users
- growth content:
  - case studies
  - success stories
  - “how to hire safely” guides
- partnership direction:
  - education centers
  - community hubs
  - local payment ecosystem partners

### 7) operations

- core team roles:
  - product and engineering
  - support/moderation
  - growth/marketing
- operational process:
  - support case queue
  - dispute review and admin decision flow
  - audit-backed actions for sensitive operations

### 8) tech plan

**current implementation base**

- frontend: react + vite + i18n
- backend: express + prisma + typed routes
- infra: postgresql + redis + docker compose
- trust and ops components:
  - audit log
  - ledger entries
  - idempotency layer
  - support case routes

**next technical steps**

- harden real payment provider integration
- deepen anti-fraud and verification stages
- improve ranking/recommendation and analytics instrumentation
- extend observability and operational reporting

### 9) financial model (diploma example)

example assumptions for a training model:

- month 1 active clients: 120
- month 1 active freelancers: 180
- average paid orders per active client per month: 1.4
- average order value: 6,500 kgs
- platform commission: 10%

approximate month 1 gross marketplace value (gmv):

- `120 * 1.4 * 6500 = 1,092,000 kgs`

approximate month 1 platform revenue:

- `1,092,000 * 10% = 109,200 kgs`

cost buckets for diploma planning:

- cloud/infra
- support and moderation labor
- growth marketing
- product development labor

break-even in this model depends on:

- order frequency growth
- stable take rate
- controlled acquisition cost

### 10) risks and mitigation

- fraud and abusive behavior:
  - mitigation: role controls, dispute flow, evidence handling, audit logs
- low liquidity at early stage:
  - mitigation: focused niche/category launch and partner channels
- operational overload in disputes:
  - mitigation: case prioritization and structured admin workflows
- strong competition:
  - mitigation: local adaptation and faster support loop

### 11) timeline (12-week launch model)

- weeks 1-2:
  - onboarding polish, setup hardening, seed/test data quality
- weeks 3-5:
  - beta onboarding of pilot users and workflow validation
- weeks 6-8:
  - payments/disputes stabilization and admin operational metrics
- weeks 9-10:
  - growth experiments and referral activation
- weeks 11-12:
  - public launch preparation and support readiness

### 12) kpi

- monthly active users (mau)
- number of created and completed orders
- gmv (gross marketplace value)
- platform take rate
- user retention (clients and freelancers)
- dispute rate and average resolution time
- customer acquisition cost (cac) and payback horizon
