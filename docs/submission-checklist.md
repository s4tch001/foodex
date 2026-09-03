# Submission Checklist

## Required Deliverables

| Requirement           | Evidence                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Source code           | `apps/web`, `apps/api`, and `packages/shared`                      |
| Prisma migration      | `apps/api/prisma/migrations/20260902000100_init/migration.sql`     |
| Environment template  | `.env.example`; root `.env` is ignored and used at runtime         |
| Automated tests       | API Vitest tests and `apps/web/e2e/technical-test-project.spec.ts` |
| README                | `README.md`                                                        |
| Technical decisions   | `docs/decisions/`                                                  |
| Setup and limitations | `README.md`                                                        |

## Functional Requirements

| Requirement                       | Implementation                                                       |
| --------------------------------- | -------------------------------------------------------------------- |
| Search products by title or term  | `GET /api/products/search` and Next.js search form                   |
| Incomplete data handling          | Normalized nullable fields and translated image/brand/name fallbacks |
| English, Dutch, German, French    | Manual persisted selector and complete UI dictionaries               |
| Locale-aware product data         | Backend maps requested locale, English, then original product name   |
| Public product name, brand, image | Public search DTO omits nutrition                                    |
| Subscriber-only nutrition         | Signed demo session plus server-side stored entitlement guard        |
| One demo user                     | `/login`, environment-configured credentials, and seeded MySQL user  |
| Recent searches in MySQL          | `RecentSearch` Prisma model and protected retrieval route            |
| Monthly Stripe Checkout           | Server-side Checkout Session with configured recurring Price ID      |
| Stripe webhooks                   | Raw-body signature verification and event ID idempotency model       |
| Secrets in environment variables  | `.env.example`, ignored `.env`, configuration validation             |

The automated suite currently contains 21 API unit/integration tests and 13 Playwright browser tests. A real MySQL migration and Stripe test-mode Checkout/webhook walkthrough remain manual acceptance checks because the automated tests use isolated provider and persistence doubles.

## Final Commands

```powershell
npm.cmd run db:generate
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test --workspace @foodex/api
npm.cmd run test:e2e --workspace @foodex/web
```

## Manual Setup Checks

- Apply migration to a local MySQL database.
- Run the seed with configured `DEMO_EMAIL`.
- Confirm the demo account can sign in using `DEMO_EMAIL` and `DEMO_PASSWORD`.
- Configure Stripe test mode and use Stripe CLI to forward signed webhooks.
- Confirm nutrition remains unavailable until a verified subscription webhook sets active or trialing status.
- Confirm selected languages fit at desktop and mobile widths.
