// These tests verify startup validation before the API opens any connections.
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnvironment = {
  DATABASE_URL: 'mysql://user:password@localhost:3306/foodex',
  STRIPE_SECRET_KEY: 'sk_test_value',
  STRIPE_WEBHOOK_SECRET: 'whsec_value',
  STRIPE_MONTHLY_PRICE_ID: 'price_value',
  DEMO_EMAIL: 'demo@technicaltest.local',
  DEMO_PASSWORD: 'DemoPassword123!',
  SESSION_SECRET: 'a-local-development-secret-with-at-least-thirty-two-characters',
};

// Cover defaults and rejection of malformed secret configuration.
describe('loadConfig', () => {
  // Defaults should make local development predictable without weakening secret validation.
  it('uses safe local defaults for non-secret values', () => {
    expect(loadConfig(validEnvironment)).toMatchObject({
      API_PORT: 4000,
      WEB_ORIGIN: 'http://localhost:3000',
    });
  });
  // Invalid provider credentials must fail during startup rather than at runtime.
  it('rejects an invalid Stripe secret key before starting the API', () => {
    expect(() => loadConfig({ ...validEnvironment, STRIPE_SECRET_KEY: 'not-a-key' })).toThrow();
  });
});
