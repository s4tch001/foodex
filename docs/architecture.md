# Architecture Notes

This document describes the implemented application boundaries and the security-sensitive data flows.

## Application Boundaries

- `apps/web` contains the Next.js, React, TypeScript, and Tailwind CSS frontend.
- `apps/api` contains the Express, TypeScript, Prisma, MySQL, Open Food Facts, and Stripe integrations.
- The API is the only service allowed to communicate with Open Food Facts and Stripe secret-key endpoints.
- The browser receives detailed nutrition only after the API verifies the demo user's stored subscription entitlement.

## Persisted Application Data

- `User` stores the one seeded demo identity and optional Stripe customer ID.
- `RecentSearch` stores recent queries for the demo user; the API returns the eight most recent distinct queries.
- `Subscription` stores the backend authorization state; client redirects never grant nutrition access.
- `ProcessedWebhookEvent` makes Stripe event processing idempotent.

## Product Search Flow

1. The web app sends a validated query and selected locale to Express.
2. Express calls Open Food Facts with a fixed field list and records the search only when the configured demo session is present.
3. The mapper selects requested locale, English, then original name and converts missing values to `null`.
4. The API returns only its stable product DTO, never the upstream payload.
5. Full-text search uses Open Food Facts Search-a-licious, which returns ranked 20-result pages without application-side post-filtering.
6. Successful pages are cached for fifteen minutes, duplicate requests are coalesced, and stale results can cover a temporary upstream failure for up to 24 hours.
7. The browser presents simple previous/next navigation rather than pretending the remote dataset is a locally owned catalog.

## Subscription Flow

1. The browser asks Express to create a Stripe Checkout Session.
2. Express creates or reuses the demo user's Stripe customer and returns only the hosted Checkout URL.
3. If the stored customer was deleted in Stripe test mode, Express creates a replacement, updates the local user, and retries Checkout once.
4. Stripe sends a signed webhook to the raw-body webhook route.
5. The API verifies the signature, records the event ID, and synchronizes the demo user's subscription state.
6. After Checkout, the API may reconcile the exact verified Checkout Session; subscription reads may refresh a known subscription directly from Stripe.
7. The protected nutrition endpoint checks the stored state before retrieving nutrition from Open Food Facts.

## Demo Authentication Flow

1. The dedicated `/login` route displays the environment-configured demo credentials for this technical test.
2. The API verifies the submitted values against `DEMO_EMAIL` and `DEMO_PASSWORD` and confirms that the seeded MySQL user exists.
3. The API issues an eight-hour signed HttpOnly, SameSite=Lax cookie.
4. Subscription status, recent searches, Checkout creation, and nutrition requests require the valid cookie.
5. Product search remains public. A valid demo session adds MySQL recent-search recording, while subscription status, Checkout, and nutrition remain private.

## Public Search and Private History

- Public visitors can search and receive only product name, brand, image, and barcode data.
- The API strips nutrition from every public search response.
- Signed-in searches are stored as `RecentSearch` records for the configured demo user.
- The client displays that private history directly beneath the search form, where a user can reuse a prior query.

## Frontend Scope

- The landing page is search-first and does not preload a product catalog.
- Authentication has a dedicated `/login` route; public subscription actions redirect there instead of swapping the landing-page component tree.
- The manual locale selector updates the interface, the document `lang`, and active search product names.
- Tailwind utilities provide the main responsive page, header, and result-grid layout. Project-specific CSS supplies the visual theme and component details.
- Cart and retail pricing are intentionally excluded because Open Food Facts does not provide authoritative commerce data and the assignment asks for discovery plus subscription-gated nutrition.
