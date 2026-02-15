import type { BillingCycle } from '../types'

export function monthlyEquivalent(amount: number, billingCycle: BillingCycle | string | null): number {
  const cycle = billingCycle ?? 'monthly'
  switch (cycle) {
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'yearly':
      return amount / 12
    case 'one_time':
      return 0
    default:
      return amount
  }
}

export function calculateMRR(
  subscriptions: Array<{ amount: number | null; billing_cycle?: string | null }>,
): number {
  return subscriptions.reduce(
    (sum, s) => sum + monthlyEquivalent(s.amount ?? 0, s.billing_cycle ?? null),
    0,
  )
}
