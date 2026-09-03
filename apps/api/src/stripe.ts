import Stripe from 'stripe';
import { prisma } from './db.js';

export function createStripe(secretKey: string) {
  return new Stripe(secretKey);
}

async function createAndStoreCustomer(input: { stripe: Stripe; userId: string; email: string }) {
  const customer = await input.stripe.customers.create({
    email: input.email,
    metadata: { userId: input.userId },
  });

  // Keep the local user linked to the Stripe customer used by future checkout attempts.
  await prisma.user.update({
    where: { id: input.userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function isMissingStripeResource(error: unknown, parameter: string) {
  if (!error || typeof error !== 'object') return false;
  const stripeError = error as { code?: unknown; param?: unknown; type?: unknown };
  return (
    stripeError.type === 'StripeInvalidRequestError' &&
    stripeError.code === 'resource_missing' &&
    stripeError.param === parameter
  );
}

export async function createSubscriptionCheckout(input: {
  stripe: Stripe;
  userId: string;
  email: string;
  customerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const createSession = (customerId: string) =>
    input.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      subscription_data: { metadata: { userId: input.userId } },
    });

  // Reuse the stored customer unless it was removed from Stripe during test-mode cleanup.
  const customerId =
    input.customerId ??
    (await createAndStoreCustomer({
      stripe: input.stripe,
      userId: input.userId,
      email: input.email,
    }));

  try {
    return await createSession(customerId);
  } catch (error) {
    if (!input.customerId || !isMissingStripeResource(error, 'customer')) throw error;

    // A deleted Stripe test customer must not leave the local account permanently unable to pay.
    const replacementCustomerId = await createAndStoreCustomer({
      stripe: input.stripe,
      userId: input.userId,
      email: input.email,
    });
    return createSession(replacementCustomerId);
  }
}

async function persistSubscription(subscription: Stripe.Subscription, userId: string) {
  const statuses: Record<
    Stripe.Subscription.Status,
    'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' | 'INCOMPLETE' | 'INACTIVE'
  > = {
    active: 'ACTIVE',
    trialing: 'TRIALING',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INACTIVE',
    paused: 'INACTIVE',
  };
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeSubscriptionId: subscription.id,
      status: statuses[subscription.status],
    },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      status: statuses[subscription.status],
    },
  });
}

export async function syncCompletedCheckout(input: {
  stripe: Stripe;
  userId: string;
  customerId: string | null;
  checkoutSessionId?: string;
}) {
  if (!input.customerId) return null;
  const sessions = input.checkoutSessionId
    ? [
        await input.stripe.checkout.sessions.retrieve(input.checkoutSessionId, {
          expand: ['subscription'],
        }),
      ]
    : (
        await input.stripe.checkout.sessions.list({
          customer: input.customerId,
          limit: 10,
          expand: ['data.subscription'],
        })
      ).data;
  const session = sessions.find(
    (candidate) =>
      candidate.mode === 'subscription' &&
      candidate.status === 'complete' &&
      (typeof candidate.customer === 'string' ? candidate.customer : candidate.customer?.id) ===
        input.customerId,
  );
  if (!session?.subscription) return null;
  const subscription =
    typeof session.subscription === 'string'
      ? await input.stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  if (subscription.metadata.userId !== input.userId) return null;
  await persistSubscription(subscription, input.userId);
  return subscription;
}

export async function syncStoredSubscription(input: {
  stripe: Stripe;
  userId: string;
  subscriptionId: string | null;
}) {
  if (!input.subscriptionId) return null;
  try {
    const subscription = await input.stripe.subscriptions.retrieve(input.subscriptionId);
    await persistSubscription(subscription, input.userId);
    return subscription;
  } catch (error) {
    if (isMissingStripeResource(error, 'id')) {
      await prisma.subscription.update({
        where: { userId: input.userId },
        data: { stripeSubscriptionId: null, status: 'CANCELED' },
      });
      return null;
    }
    throw error;
  }
}

export async function processSubscriptionEvent(event: Stripe.Event) {
  // Only Stripe subscription events can update the nutrition entitlement.
  if (!event.type.startsWith('customer.subscription.')) return;
  const subscription = event.data.object as Stripe.Subscription;
  const userId = subscription.metadata.userId;
  if (!userId) return;
  await persistSubscription(subscription, userId);
}
