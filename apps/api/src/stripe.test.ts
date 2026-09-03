import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  updateUser: vi.fn(),
  upsertSubscription: vi.fn(),
}));

vi.mock('./db.js', () => ({
  prisma: {
    user: { update: database.updateUser },
    subscription: { upsert: database.upsertSubscription },
  },
}));

import { createSubscriptionCheckout, processSubscriptionEvent } from './stripe.js';

describe('createSubscriptionCheckout', () => {
  beforeEach(() => {
    database.updateUser.mockReset();
    database.upsertSubscription.mockReset();
  });

  it('replaces a locally stored customer that was deleted from Stripe', async () => {
    const createSession = vi
      .fn()
      .mockRejectedValueOnce(
        new Stripe.errors.StripeInvalidRequestError({
          code: 'resource_missing',
          message: "No such customer: 'cus_deleted'",
          param: 'customer',
          type: 'invalid_request_error',
        }),
      )
      .mockResolvedValueOnce({ id: 'cs_test_recovered', url: 'https://checkout.stripe.test' });
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_replacement' }) },
      checkout: { sessions: { create: createSession } },
    } as unknown as Stripe;

    const session = await createSubscriptionCheckout({
      stripe,
      userId: 'user_1',
      email: 'demo@example.com',
      customerId: 'cus_deleted',
      priceId: 'price_monthly',
      successUrl: 'http://localhost:3000/?checkout=success',
      cancelUrl: 'http://localhost:3000/?checkout=canceled',
    });

    expect(session.id).toBe('cs_test_recovered');
    expect(createSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ customer: 'cus_replacement', mode: 'subscription' }),
    );
    expect(database.updateUser).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { stripeCustomerId: 'cus_replacement' },
    });
  });

  it('does not replace a customer for unrelated Stripe errors', async () => {
    const stripe = {
      customers: { create: vi.fn() },
      checkout: {
        sessions: {
          create: vi.fn().mockRejectedValue(
            new Stripe.errors.StripeInvalidRequestError({
              code: 'resource_missing',
              message: "No such price: 'price_missing'",
              param: 'line_items[0][price]',
              type: 'invalid_request_error',
            }),
          ),
        },
      },
    } as unknown as Stripe;

    await expect(
      createSubscriptionCheckout({
        stripe,
        userId: 'user_1',
        email: 'demo@example.com',
        customerId: 'cus_valid',
        priceId: 'price_missing',
        successUrl: 'http://localhost:3000/?checkout=success',
        cancelUrl: 'http://localhost:3000/?checkout=canceled',
      }),
    ).rejects.toMatchObject({ param: 'line_items[0][price]' });
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it('persists the Stripe item period used by the backend entitlement guard', async () => {
    const currentPeriodEnd = 1_800_000_000;
    const subscription = {
      id: 'sub_active',
      status: 'active',
      metadata: { userId: 'user_1' },
      items: { data: [{ current_period_end: currentPeriodEnd }] },
    } as unknown as Stripe.Subscription;

    await processSubscriptionEvent({
      type: 'customer.subscription.updated',
      data: { object: subscription },
    } as Stripe.Event);

    const expectedPeriodEnd = new Date(currentPeriodEnd * 1_000);
    expect(database.upsertSubscription).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      update: {
        stripeSubscriptionId: 'sub_active',
        status: 'ACTIVE',
        currentPeriodEnd: expectedPeriodEnd,
      },
      create: {
        userId: 'user_1',
        stripeSubscriptionId: 'sub_active',
        status: 'ACTIVE',
        currentPeriodEnd: expectedPeriodEnd,
      },
    });
  });
});
