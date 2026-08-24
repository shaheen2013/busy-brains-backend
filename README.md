# Busy Brains Backend

NestJS + TypeORM/Postgres API for Busy Brains: Clerk auth, Stripe payments (one-time
and weekly recurring plans), Kit (ConvertKit) transactional email, and Puppeteer-generated
PDF reports.

## Requirements

- Node.js 22+
- pnpm
- PostgreSQL (a `docker-compose.yml` Postgres service is included for local dev)

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in real values, see below
```

Start Postgres locally (or point `DB_HOST`/`DB_PORT` in `.env` at your own instance):

```bash
docker compose up -d db
```

Seed reference data (plans, weekly plans):

```bash
pnpm run plans:seed
pnpm run weekly-plans:seed
```

## Running locally

```bash
pnpm run dev          # watch mode
pnpm run start        # no watch
pnpm run build && pnpm run start:prod
```

The API listens on `PORT` (default `3001`). Swagger docs are served at `/api/docs`,
gated behind HTTP Basic auth using `DOCS_USER`/`DOCS_PASSWORD`.

## Environment variables

See `.env.example` for the full list with comments. Required in every environment:
Postgres connection, `DOCS_USER`/`DOCS_PASSWORD`, `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the Stripe
price IDs. Everything else has a documented purpose inline.

## Useful scripts

| Script                       | Purpose                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm run dev`               | Start the API in watch mode                                                                       |
| `pnpm run lint`              | ESLint (with `--fix`)                                                                             |
| `pnpm run format`            | Prettier over the whole repo                                                                      |
| `pnpm run test`              | Unit tests (Jest)                                                                                 |
| `pnpm run test:e2e`          | E2E tests against a throwaway Postgres in Docker                                                  |
| `pnpm run test:cov`          | Unit tests with coverage                                                                          |
| `pnpm run plans:seed`        | Seed the one-time `Plan` rows + Stripe products/prices                                            |
| `pnpm run weekly-plans:seed` | Seed `WeeklyPlan` rows, Stripe weekly products/prices, and the Stripe webhook's subscribed events |
| `pnpm run fresh:seed`        | Full local reset seed (plans + weekly plans)                                                      |

Testing Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

## Deployment

Staging and production each run via Docker Compose (`docker compose up -d --build`)
on push to their respective `staging`/`main` branches — see
`.github/workflows/staging.yml` and `.github/workflows/production.yml`. `.env` is
created manually on each server and is never overwritten by a deploy.
