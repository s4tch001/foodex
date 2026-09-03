import type { SubscriptionStatus } from '@prisma/client';

/** Returns whether the stored subscription currently grants nutrition access. */
export function canAccessNutrition(
  subscription: { status: SubscriptionStatus; currentPeriodEnd: Date | null } | null,
): boolean {
  // Nutrition is available only while Stripe reports an active, trialing, and non-expired plan.
  // Only usable Stripe states can reveal detailed nutrition values.
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status)) return false;
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date();
}
