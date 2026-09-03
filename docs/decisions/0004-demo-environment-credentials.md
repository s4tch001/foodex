# ADR 0004: Environment-Configured Demo Credentials

## Context

The technical test requires one demo account and asks for its credentials to be displayed in the login form. The project owner requires the credentials to remain in environment configuration.

## Decision

`DEMO_EMAIL` and `DEMO_PASSWORD` remain environment variables. The seed uses `DEMO_EMAIL` to create the corresponding MySQL user and inactive subscription record. Login confirms that the configured user exists in MySQL, validates the configured password, and then issues a signed HttpOnly session cookie.

## Consequences

The database owns the demo account identity, recent searches, Stripe customer association, and subscription state. The environment owns the deliberately public technical-test password. This is not a production password-storage pattern and is documented as a demo-only simplification.

## Alternatives Considered

Persisting a password hash in MySQL was rejected because the project owner explicitly required the demo credentials to remain in environment configuration.
