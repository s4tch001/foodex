import { describe, expect, it } from 'vitest';
import { canAccessNutrition } from './entitlement.js';

describe('canAccessNutrition', () => {
  it('allows active and trialing subscriptions with a valid period', () => {
    expect(
      canAccessNutrition({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 60_000) }),
    ).toBe(true);
    expect(canAccessNutrition({ status: 'TRIALING', currentPeriodEnd: null })).toBe(true);
  });

  it('denies inactive, overdue, and expired subscriptions', () => {
    expect(canAccessNutrition(null)).toBe(false);
    expect(canAccessNutrition({ status: 'PAST_DUE', currentPeriodEnd: null })).toBe(false);
    expect(
      canAccessNutrition({ status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - 60_000) }),
    ).toBe(false);
  });
});
