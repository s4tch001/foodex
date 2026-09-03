// Stripe is used only on the server so secret keys never reach the browser.
import Stripe from 'stripe';
import { prisma } from './db.js';

/** Creates the server-only Stripe client from a validated secret key. */
export function createStripe(secretKey: string) {
  return new Stripe(secretKey);
}

async function createAndStoreCustomer(input: { stripe: Stripe; userId: string; email: string }) {
  // Create a customer and persist its ID so later Checkout sessions can reuse it.
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
  // Distinguish deleted test resources from unrelated Stripe failures before retrying.
  if (!error || typeof error !== 'object') return false;
  const stripeError = error as { code?: unknown; param?: unknown; type?: unknown };
  return (
    stripeError.type === 'StripeInvalidRequestError' &&
    stripeError.code === 'resource_missing' &&
    stripeError.param === parameter
  );
}

/** Creates a monthly Checkout Session and repairs a deleted test customer once when needed. */
export async function createSubscriptionCheckout(input: {
  stripe: Stripe;
  userId: string;
  email: string;
  customerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  // Create a monthly subscription Checkout session for the configured demo user.
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
  // Map Stripe statuses and billing dates into the local entitlement record.
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
  // Stripe's current API stores billing-period boundaries on subscription items.
  const periodEnds = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value) => Number.isFinite(value));
  const currentPeriodEnd = periodEnds.length ? new Date(Math.max(...periodEnds) * 1_000) : null;
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      stripeSubscriptionId: subscription.id,
      status: statuses[subscription.status],
      currentPeriodEnd,
    },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      status: statuses[subscription.status],
      currentPeriodEnd,
    },
  });
}

/** Reconciles a completed, customer-owned Checkout Session after the Stripe redirect. */
export async function syncCompletedCheckout(input: {
  stripe: Stripe;
  userId: string;
  customerId: string | null;
  checkoutSessionId?: string;
}) {
  // Reconcile the browser's return from Checkout without trusting browser-provided entitlement data.
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

/** Refreshes the locally stored entitlement from its known Stripe subscription. */
export async function syncStoredSubscription(input: {
  stripe: Stripe;
  userId: string;
  subscriptionId: string | null;
}) {
  // Refresh a previously known subscription and revoke access if Stripe no longer has it.
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

/** Applies supported Stripe subscription events to the backend authorization record. */
export async function processSubscriptionEvent(event: Stripe.Event) {
  // Apply only subscription lifecycle events received through Stripe's signed webhook route.
  // Only Stripe subscription events can update the nutrition entitlement.
  if (!event.type.startsWith('customer.subscription.')) return;
  const subscription = event.data.object as Stripe.Subscription;
  const userId = subscription.metadata.userId;
  if (!userId) return;
  await persistSubscription(subscription, userId);
}
