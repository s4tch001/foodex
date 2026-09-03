import { config } from 'dotenv';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

// This workspace starts under apps/api, so load the repository-root local environment file explicitly.
config({ path: '../../.env' });

const environment = loadConfig();

const app = createApp(
  environment.WEB_ORIGIN,
  {
    secretKey: environment.STRIPE_SECRET_KEY,
    priceId: environment.STRIPE_MONTHLY_PRICE_ID,
    webhookSecret: environment.STRIPE_WEBHOOK_SECRET,
  },
  {
    email: environment.DEMO_EMAIL,
    password: environment.DEMO_PASSWORD,
    sessionSecret: environment.SESSION_SECRET,
  },
);

app.listen(environment.API_PORT, () => {
  console.info(`Foodex API listening on port ${environment.API_PORT}`);
});
