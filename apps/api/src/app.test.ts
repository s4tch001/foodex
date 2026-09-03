// These integration tests verify route validation, authorization, and webhook idempotency.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  findUser: vi.fn(),
  createRecentSearch: vi.fn(),
  deleteRecentSearch: vi.fn(),
  findProcessedEvent: vi.fn(),
  createProcessedEvent: vi.fn(),
}));
const provider = vi.hoisted(() => ({
  searchProducts: vi.fn(),
  getProductsByBarcodes: vi.fn(),
}));
const subscription = vi.hoisted(() => ({
  getDemoUser: vi.fn(),
  constructEvent: vi.fn(),
  processSubscriptionEvent: vi.fn(),
}));

vi.mock('./db.js', () => ({
  getDemoUser: subscription.getDemoUser,
  prisma: {
    user: { findUnique: database.findUser },
    recentSearch: {
      create: database.createRecentSearch,
      findMany: vi.fn(),
      deleteMany: database.deleteRecentSearch,
    },
    processedWebhookEvent: {
      findUnique: database.findProcessedEvent,
      create: database.createProcessedEvent,
    },
  },
}));

vi.mock('./open-food-facts.js', () => ({
  searchProducts: provider.searchProducts,
  getProductsByBarcodes: provider.getProductsByBarcodes,
  toPublicProduct: (product: Record<string, unknown>) => {
    const { nutrition: _nutrition, ...publicProduct } = product;
    return publicProduct;
  },
}));

vi.mock('./stripe.js', () => ({
  createStripe: vi.fn(() => ({
    webhooks: { constructEvent: subscription.constructEvent },
  })),
  createSubscriptionCheckout: vi.fn(),
  processSubscriptionEvent: subscription.processSubscriptionEvent,
  syncCompletedCheckout: vi.fn(),
  syncStoredSubscription: vi.fn(),
}));

import { createApp } from './app.js';

const authConfig = {
  email: 'demo@example.com',
  password: 'DemoPassword123!',
  sessionSecret: 'test-session-secret',
};
const stripeConfig = {
  secretKey: 'sk_test_example',
  priceId: 'price_test_example',
  webhookSecret: 'whsec_test_example',
};
const fullProduct = {
  barcode: '3017624010701',
  name: 'Nutella',
  brand: 'Ferrero',
  imageUrl: null,
  nutrition: { protein: 6 },
};

// Use mocked dependencies while exercising the real Express routing and cookie behavior.
describe('Express app integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.findUser.mockResolvedValue({ id: 'user_1' });
    database.createRecentSearch.mockResolvedValue({ id: 'search_1' });
    database.deleteRecentSearch.mockResolvedValue({ count: 1 });
    database.findProcessedEvent.mockResolvedValue(null);
    database.createProcessedEvent.mockResolvedValue({ id: 'evt_1' });
    provider.searchProducts.mockResolvedValue({
      products: [fullProduct],
      pagination: { page: 1, hasNext: false, hasPrevious: false },
    });
    provider.getProductsByBarcodes.mockResolvedValue({
      products: [fullProduct],
      failedBarcodes: [],
    });
    subscription.getDemoUser.mockResolvedValue({
      id: 'user_1',
      email: authConfig.email,
      stripeCustomerId: null,
      subscription: { status: 'INACTIVE', currentPeriodEnd: null },
    });
    subscription.constructEvent.mockReturnValue({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      data: { object: {} },
    });
    subscription.processSubscriptionEvent.mockResolvedValue(undefined);
  });

  // Public catalog responses must never leak protected nutrition fields.
  it('keeps nutrition out of the public search response', async () => {
    const response = await request(createApp('http://localhost:3000', stripeConfig, authConfig))
      .get('/api/products/search')
      .query({ query: 'nutella', locale: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.products[0]).toMatchObject({
      name: 'Nutella',
      barcode: fullProduct.barcode,
    });
    expect(response.body.products[0]).not.toHaveProperty('nutrition');
  });

  // Anonymous callers cannot reach the nutrition provider endpoint.
  it('rejects nutrition access without a signed session', async () => {
    const response = await request(createApp('http://localhost:3000', stripeConfig, authConfig))
      .post('/api/products/nutrition')
      .send({ barcodes: [fullProduct.barcode], locale: 'en' });

    expect(response.status).toBe(401);
    expect(provider.getProductsByBarcodes).not.toHaveBeenCalled();
  });

  // A valid login alone is not enough to unlock nutrition.
  it('rejects an authenticated user without an active subscription', async () => {
    const client = request.agent(createApp('http://localhost:3000', stripeConfig, authConfig));
    await client.post('/api/auth/login').send({
      email: authConfig.email,
      password: authConfig.password,
    });
    const response = await client
      .post('/api/products/nutrition')
      .send({ barcodes: [fullProduct.barcode], locale: 'en' });

    expect(response.status).toBe(403);
    expect(provider.getProductsByBarcodes).not.toHaveBeenCalled();
  });

  // Active subscribers receive normalized nutrition data from the protected route.
  it('returns nutrition for an authenticated active subscriber', async () => {
    subscription.getDemoUser.mockResolvedValue({
      id: 'user_1',
      email: authConfig.email,
      stripeCustomerId: null,
      subscription: { status: 'ACTIVE', currentPeriodEnd: null },
    });
    const client = request.agent(createApp('http://localhost:3000', stripeConfig, authConfig));
    await client.post('/api/auth/login').send({
      email: authConfig.email,
      password: authConfig.password,
    });
    const response = await client
      .post('/api/products/nutrition')
      .send({ barcodes: [fullProduct.barcode], locale: 'en' });

    expect(response.status).toBe(200);
    expect(response.body.products[fullProduct.barcode]).toEqual({
      status: 'available',
      nutrition: { protein: 6 },
    });
  });

  // Search history is recorded only for authenticated first-page searches.
  it('stores recent searches only for a signed-in first-page request', async () => {
    const app = createApp('http://localhost:3000', stripeConfig, authConfig);
    const client = request.agent(app);
    await client.post('/api/auth/login').send({
      email: authConfig.email,
      password: authConfig.password,
    });
    await client.get('/api/products/search').query({ query: 'oat milk', locale: 'nl', page: 1 });

    expect(database.createRecentSearch).toHaveBeenCalledWith({
      data: { userId: 'user_1', query: 'oat milk', locale: 'nl' },
    });
  });

  // Deletion must include the owner condition to prevent cross-account access.
  it('deletes one recent search only for its signed-in owner', async () => {
    const client = request.agent(createApp('http://localhost:3000', stripeConfig, authConfig));
    await client.post('/api/auth/login').send({
      email: authConfig.email,
      password: authConfig.password,
    });

    const response = await client.delete('/api/recent-searches/search_1');

    expect(response.status).toBe(204);
    expect(database.deleteRecentSearch).toHaveBeenCalledWith({
      where: { id: 'search_1', userId: 'user_1' },
    });
  });

  // Invalid webhook signatures are rejected before any subscription mutation.
  it('rejects a webhook with an invalid Stripe signature', async () => {
    subscription.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const response = await request(createApp('http://localhost:3000', stripeConfig, authConfig))
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'invalid')
      .set('content-type', 'application/json')
      .send('{"id":"evt_1"}');

    expect(response.status).toBe(400);
    expect(subscription.processSubscriptionEvent).not.toHaveBeenCalled();
  });

  // Repeated delivery of the same event must be idempotent.
  it('processes each valid Stripe webhook event once', async () => {
    const app = createApp('http://localhost:3000', stripeConfig, authConfig);
    const first = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'valid')
      .set('content-type', 'application/json')
      .send('{"id":"evt_1"}');
    database.findProcessedEvent.mockResolvedValue({ id: 'evt_1' });
    const repeated = await request(app)
      .post('/api/stripe/webhook')
      .set('stripe-signature', 'valid')
      .set('content-type', 'application/json')
      .send('{"id":"evt_1"}');

    expect(first.status).toBe(200);
    expect(repeated.status).toBe(200);
    expect(subscription.processSubscriptionEvent).toHaveBeenCalledTimes(1);
    expect(database.createProcessedEvent).toHaveBeenCalledTimes(1);
  });
});
