# ADR 0002: Product Localization Fallback

## Context

Open Food Facts product translations are incomplete and vary by product.

## Decision

The backend selects the requested localized product name first, then English, then the source product name. It returns `null` when no name exists. The UI must present source-data fallbacks without claiming that all data is translated.

## Consequences

Product result shape remains stable across languages and incomplete upstream records.

## Alternatives Considered

Automatic translation was rejected because it would introduce generated product claims not supplied by the source.
