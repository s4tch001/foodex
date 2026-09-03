import type { SubscriptionStatus } from '@prisma/client';

export function canAccessNutrition(
  subscription: { status: SubscriptionStatus; currentPeriodEnd: Date | null } | null,
): boolean {
  // Only usable Stripe states can reveal detailed nutrition values.
  if (!subscription || !['ACTIVE', 'TRIALING'].includes(subscription.status)) return false;
  return !subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date();
}
