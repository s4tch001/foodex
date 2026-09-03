# ADR 0003: Stripe Webhooks Control Nutrition Entitlement

## Context

Checkout redirects can be forged or arrive before payment state is finalized.

## Decision

Stripe remains authoritative for stored subscription state. Signed webhooks are the primary update path, and processed event IDs are persisted so duplicate deliveries do not repeat synchronization. The API can also reconcile the exact Checkout Session returned by Stripe and refresh a previously stored subscription directly from Stripe. Nutrition access requires an active or trialing stored subscription; URL parameters and client state never grant access.

Checkout reuses the stored Stripe customer. When Stripe reports that the customer was deleted, the API creates and persists one replacement customer and retries Checkout once. This recovery changes only the customer association and never grants nutrition entitlement.

## Consequences

The browser cannot grant itself nutrition access. Local development should forward Stripe events to the webhook endpoint, while verified reconciliation handles redirect/webhook timing safely. Test-mode customer cleanup no longer leaves the demo account permanently unable to start a new Checkout Session.

## Alternatives Considered

Granting access from the Checkout success URL alone was rejected because browser-controlled state is not an authoritative payment signal.
