// These unit tests protect the subscription rule used by the nutrition authorization guard.
import { describe, expect, it } from 'vitest';
import { canAccessNutrition } from './entitlement.js';

// Check both allowed subscription states and every denial condition.
describe('canAccessNutrition', () => {
  // Active and trialing plans are the only states that can reveal nutrition.
  it('allows active and trialing subscriptions with a valid period', () => {
    expect(
      canAccessNutrition({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 60_000) }),
    ).toBe(true);
    expect(canAccessNutrition({ status: 'TRIALING', currentPeriodEnd: null })).toBe(true);
  });

  // Missing, non-usable, and expired plans must all remain protected.
  it('denies inactive, overdue, and expired subscriptions', () => {
    expect(canAccessNutrition(null)).toBe(false);
    expect(canAccessNutrition({ status: 'PAST_DUE', currentPeriodEnd: null })).toBe(false);
    expect(
      canAccessNutrition({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - 60_000) }),
    ).toBe(false);
  });
});
