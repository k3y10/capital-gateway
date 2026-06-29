# Production Readiness Checklist

## Database

- Run `pnpm run db:migrate` against the production Postgres database.
- Run `pnpm run prisma:validate` and `pnpm run prisma:generate` during CI.
- Keep `DATABASE_POOL_MAX` sized for the deployment environment. Use managed pooling for serverless providers.
- Back up Postgres before applying migrations.

## API

- Set `NODE_ENV=production`.
- Set `CAPITAL_ADMIN_API_TOKEN` to a long random secret.
- Set `PARTNER_TOKEN_REQUIRED=true`.
- Set exact `CORS_ORIGIN` values. Do not use `*` in production.
- Confirm `/api/health` and `/api/readiness`.
- Keep the API behind HTTPS.

## Frontend

- Do not set `VITE_CAPITAL_ADMIN_API_TOKEN` in production.
- Do not set partner portal tokens in production browser envs.
- The Vite MVP accepts admin/partner tokens at runtime through session storage. Replace this with authenticated backend/session plumbing before exposing the admin UI publicly.
- Use exact `VITE_CAPITAL_API_BASE_URL` if the frontend and API are deployed to separate origins.

## Compliance And Capital Controls

- The platform records indication of interest only.
- Do not enable settlement until compliance review is verified, the wallet is allowlisted, and offering documents are approved.
- Use `compliance_reviews`, `approved_wallets`, and `settlement_intents` for future approved funding steps.
- Backend status changes enforce these gates: verified compliance before `Accredited Verified` or later statuses, active approved wallet before `Approved`/`Soft Committed`/`Funded`, and confirmed settlement intent with transaction hash before `Funded`.
- Maintain final legal, tax, risk, privacy, sanctions, KYC/KYB, and transfer disclosures outside the codebase with counsel-approved versions.
- Referral attribution must remain non-transactional unless reviewed by counsel.

## Dataroom

- Store document files in private object storage.
- Keep only metadata and storage URI references in `dataroom_documents`.
- Use `GET /api/dataroom/documents/:documentId/access?partnerCode=...&event=view|download` to re-check partner/project access before a storage URL is returned.
- Track every view/download in `dataroom_events`.
- Prefer short-lived signed URLs in production. Static object URLs should only point to storage objects protected by the provider's own authorization layer.

## Database Model Coverage

Required tables are included in the migration and Prisma schema: `users`, `partners`, `referral_links`, `projects`, `capital_interests`, `wallet_connections`, `dataroom_documents`, `dataroom_access`, `dataroom_events`, `status_events`, `admin_notes`, `activity_logs`, `compliance_reviews`, `approved_wallets`, and `settlement_intents`.

## CI Verification

Run:

```bash
pnpm run prisma:validate
pnpm run typecheck
pnpm run lint
pnpm run build
node --check api/server.mjs
node --check api/migrate.mjs
node --check api/seed.mjs
```
