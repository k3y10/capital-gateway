# MindLaunch Capital Gateway

Production-oriented partner referral, capital interest, compliance routing, and dataroom platform for the MindLaunch ecosystem.

MindLaunch positioning: post-AI venture capital, private equity, venture studio operations, and compliance-gated private capital workflows. This is not an investment checkout, token launch, presale, or crowdfunding surface.

## Stack

- Vite, React, TypeScript
- Node HTTP API
- Postgres
- Prisma schema for ORM/introspection/type generation
- SQL migrations for repeatable deploys
- Zod API validation
- Coinbase Wallet / MetaMask browser wallet connection

## Local Setup

1. Copy environment values:

```bash
cp .env.example .env
```

2. Start Postgres:

```bash
docker compose up postgres
```

3. Apply schema and seed operating records:

```bash
pnpm install
pnpm run db:migrate
pnpm run db:seed
pnpm run prisma:generate
```

4. Run API and app:

```bash
pnpm run api:dev
pnpm run dev
```

Open `http://localhost:5173/capital-gateway`.

## Production Commands

```bash
pnpm run db:migrate
pnpm run prisma:generate
pnpm run build
pnpm run api:start
```

## Required Production Env

- `DATABASE_URL`
- `DATABASE_SSL=true` when your managed Postgres provider requires TLS
- `CAPITAL_ADMIN_API_TOKEN`, at least 32 random characters
- `CORS_ORIGIN`, exact deployed frontend origin(s)
- `PARTNER_TOKEN_REQUIRED=true`
- `PARTNER_TOKEN_*` values before seeding partner portal access

## Security Boundary

Public API state excludes leads, notes, wallet records, and private dataroom permissions.

Partner API state requires a partner portal token and returns only that partner's masked lead pipeline, referral metrics, and granted dataroom documents.

Admin API state requires `Authorization: Bearer <CAPITAL_ADMIN_API_TOKEN>` and returns full lead, note, access, and activity records.

Do not ship `VITE_CAPITAL_ADMIN_API_TOKEN` or partner portal tokens in production frontend builds. Admin and partner pages accept server-issued tokens at runtime for this Vite MVP; production deployment should replace that with first-party auth/session middleware at the API boundary.

## Funding Boundary

No route moves funds. USDC is represented only as:

- Intended amount in capital interest records
- Base L2 readiness config
- Future settlement intent tables
- Approved wallet allowlist tables

Before any payment rail is enabled, production must require verified compliance review, admin approval, offering documents, wallet allowlisting, settlement intent creation, and smart contract review.

The API enforces the critical pipeline gates:

- `Accredited Verified`, `Approved`, `Soft Committed`, and `Funded` require a verified `compliance_reviews` record.
- `Approved`, `Soft Committed`, and `Funded` require an active `approved_wallets` record.
- `Funded` requires a confirmed `settlement_intents` record with a transaction hash.

## Dataroom Files

Document metadata lives in Postgres. Actual files belong in private object storage. Admins attach an approved storage URL to `dataroom_documents.storage_uri`; partner views can only retrieve it through `GET /api/dataroom/documents/:documentId/access`, which re-checks partner token, project access, document status, and visibility before recording the view/download event.
