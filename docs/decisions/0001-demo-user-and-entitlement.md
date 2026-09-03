# ADR 0001: Demo User and Stored Subscription Entitlement

## Context

The assignment requires one demo user, stored recent searches, Stripe subscriptions, and server-side nutrition protection without requiring a production authentication system.

## Decision

Seed one user using the environment-configured `DEMO_EMAIL` with one subscription record. The backend resolves this user directly for the demo. Nutrition authorization uses only the stored subscription record after its state has been verified against Stripe.

## Consequences

The scope stays focused and reviewable. This is not production authentication and must remain documented as a demo-only simplification.

## Alternatives Considered

Building sign-up and multi-user identity management was rejected because it adds unrelated authentication complexity to the technical test.
