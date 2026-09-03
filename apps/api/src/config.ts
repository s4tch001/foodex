import { z } from 'zod';

// Validate all startup settings before the API begins accepting requests.
const schema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_MONTHLY_PRICE_ID: z.string().startsWith('price_'),
  DEMO_EMAIL: z.string().email(),
  DEMO_PASSWORD: z.string().min(12),
  SESSION_SECRET: z.string().min(32),
});

export type AppConfig = z.infer<typeof schema>;

/** Stops startup early when required environment configuration is incomplete or malformed. */
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return schema.parse(environment);
}
