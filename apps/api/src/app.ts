import cors from 'cors';
import express from 'express';
import { supportedLocales } from '@foodex/shared';
import { z } from 'zod';
import { getDemoUser } from './db.js';
import { prisma } from './db.js';
import { getProductsByBarcodes, searchProducts, toPublicProduct } from './open-food-facts.js';
import {
  createStripe,
  createSubscriptionCheckout,
  processSubscriptionEvent,
  syncCompletedCheckout,
  syncStoredSubscription,
} from './stripe.js';
import { canAccessNutrition } from './entitlement.js';
import { clearDemoSession, hasValidDemoSession, issueDemoSession } from './auth.js';

export function createApp(
  webOrigin: string,
  stripeConfig?: { secretKey: string; priceId: string; webhookSecret: string },
  authConfig?: { email: string; password: string; sessionSecret: string },
) {
  const app = express();

  app.use(cors({ origin: webOrigin, credentials: true }));
  // Stripe verifies signed raw bytes, so this route must precede JSON parsing.
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (request, response) => {
      if (!stripeConfig) return response.sendStatus(503);
      try {
        const signature = request.headers['stripe-signature'];
        if (!signature) return response.status(400).json({ message: 'Missing Stripe signature.' });
        const event = createStripe(stripeConfig.secretKey).webhooks.constructEvent(
          request.body,
          signature,
          stripeConfig.webhookSecret,
        );
        const processed = await prisma.processedWebhookEvent.findUnique({
          where: { id: event.id },
        });
        if (!processed) {
          await processSubscriptionEvent(event);
          await prisma.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
        }
        response.sendStatus(200);
      } catch {
        response.status(400).json({ message: 'Webhook signature verification failed.' });
      }
    },
  );
  app.use(express.json());

  app.post('/api/auth/login', async (request, response, next) => {
    if (!authConfig) return response.sendStatus(503);
    const credentials = z
      .object({ email: z.string().email(), password: z.string().min(1).max(200) })
      .safeParse(request.body);
    try {
      const demoUser = await prisma.user.findUnique({ where: { email: authConfig.email } });
      if (
        !credentials.success ||
        credentials.data.email !== authConfig.email ||
        credentials.data.password !== authConfig.password ||
        !demoUser
      )
        return response.status(401).json({ message: 'Invalid email or password.' });
      issueDemoSession(response, authConfig.email, authConfig.sessionSecret);
      response.json({ user: { email: authConfig.email } });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', (_request, response) => {
    clearDemoSession(response);
    response.sendStatus(204);
  });

  // This test project intentionally displays its environment-configured demo credentials.
  app.get('/api/auth/demo-credentials', (_request, response) => {
    if (!authConfig) return response.sendStatus(503);
    response.json({ email: authConfig.email, password: authConfig.password });
  });

  app.get('/api/auth/session', (request, response) => {
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ authenticated: false });
    response.json({ authenticated: true, user: { email: authConfig.email } });
  });

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.delete('/api/recent-searches', async (request, response, next) => {
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to clear recent searches.' });
    try {
      const user = await getDemoUser(authConfig.email);
      await prisma.recentSearch.deleteMany({ where: { userId: user.id } });
      response.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/subscription', async (request, response, next) => {
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to view subscription status.' });
    try {
      const user = await getDemoUser(authConfig.email);
      if (stripeConfig) {
        await syncStoredSubscription({
          stripe: createStripe(stripeConfig.secretKey),
          userId: user.id,
          subscriptionId: user.subscription?.stripeSubscriptionId ?? null,
        });
      }
      const refreshedUser = await getDemoUser(authConfig.email);
      response.json({ status: refreshedUser.subscription?.status ?? 'INACTIVE' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/products/search', async (request, response) => {
    const result = z
      .object({
        query: z.string().trim().min(2).max(120),
        locale: z.enum(supportedLocales).default('en'),
        page: z.coerce.number().int().positive().max(100_000).default(1),
      })
      .safeParse(request.query);
    if (!result.success)
      return response
        .status(400)
        .json({ message: 'Provide a search query between 2 and 120 characters.' });
    try {
      const searchPage = await searchProducts(
        result.data.query,
        result.data.locale,
        result.data.page,
      );
      // Search is public; history belongs only to the signed-in demo account.
      const signedIn =
        authConfig && hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret);
      if (signedIn && result.data.page === 1) {
        const user = await getDemoUser(authConfig.email);
        await prisma.recentSearch.create({
          data: { userId: user.id, query: result.data.query, locale: result.data.locale },
        });
      }
      response.json({
        products: searchPage.products.map(toPublicProduct),
        pagination: searchPage.pagination,
      });
    } catch {
      response.status(503).json({ message: 'Product search temporarily unavailable.' });
    }
  });

  app.get('/api/recent-searches', async (request, response, next) => {
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to view recent searches.' });
    try {
      const user = await getDemoUser(authConfig.email);
      const searches = await prisma.recentSearch.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        distinct: ['query'],
      });
      response.json({ searches });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/checkout', async (request, response, next) => {
    if (!stripeConfig)
      return response.status(503).json({ message: 'Subscriptions are not configured.' });
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to manage a subscription.' });
    try {
      const user = await getDemoUser(authConfig.email);
      const session = await createSubscriptionCheckout({
        stripe: createStripe(stripeConfig.secretKey),
        userId: user.id,
        email: user.email,
        customerId: user.stripeCustomerId,
        priceId: stripeConfig.priceId,
        successUrl: `${webOrigin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${webOrigin}/?checkout=canceled`,
      });
      if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
      response.json({ url: session.url });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/checkout/complete', async (request, response, next) => {
    if (!stripeConfig)
      return response.status(503).json({ message: 'Subscriptions are not configured.' });
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to confirm a subscription.' });
    const result = z
      .object({ sessionId: z.string().trim().min(1).max(255).optional() })
      .safeParse(request.body);
    if (!result.success) return response.status(400).json({ message: 'Invalid Checkout Session.' });
    try {
      const user = await getDemoUser(authConfig.email);
      const subscription = await syncCompletedCheckout({
        stripe: createStripe(stripeConfig.secretKey),
        userId: user.id,
        customerId: user.stripeCustomerId,
        checkoutSessionId: result.data.sessionId,
      });
      const refreshedUser = await getDemoUser(authConfig.email);
      response.json({
        status: refreshedUser.subscription?.status ?? subscription?.status ?? 'INACTIVE',
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/products/nutrition', async (request, response, next) => {
    const result = z
      .object({
        barcodes: z
          .array(z.string().regex(/^\d{8,14}$/))
          .min(1)
          .max(20),
        locale: z.enum(supportedLocales).default('en'),
      })
      .safeParse(request.body);
    if (!result.success)
      return response
        .status(400)
        .json({ message: 'Provide one to twenty valid product barcodes.' });
    if (!authConfig || !hasValidDemoSession(request, authConfig.email, authConfig.sessionSecret))
      return response.status(401).json({ message: 'Sign in to view nutrition details.' });
    try {
      const user = await getDemoUser(authConfig.email);
      if (!canAccessNutrition(user.subscription))
        return response
          .status(403)
          .json({ message: 'An active subscription is required for nutrition details.' });
      const barcodes = [...new Set(result.data.barcodes)];
      const lookup = await getProductsByBarcodes(barcodes, result.data.locale);
      const productsByBarcode = new Map(
        lookup.products.map((product) => [product.barcode, product]),
      );
      const failedBarcodes = new Set(lookup.failedBarcodes);
      response.json({
        products: Object.fromEntries(
          barcodes.map((barcode) => {
            const product = productsByBarcode.get(barcode);
            const hasNutrition =
              product && Object.values(product.nutrition).some((value) => value !== undefined);
            return [
              barcode,
              failedBarcodes.has(barcode)
                ? { status: 'error' }
                : hasNutrition
                  ? { status: 'available', nutrition: product.nutrition }
                  : { status: 'unavailable' },
            ];
          }),
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(error);
      response.status(500).json({ message: 'The service is temporarily unavailable.' });
    },
  );

  return app;
}
