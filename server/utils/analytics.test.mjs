import { describe, expect, it } from 'vitest';
import { buildAnalyticsSummary } from './analytics.js';

describe('analytics helpers', () => {
  it('builds a summary payload for a tenant view', () => {
    const summary = buildAnalyticsSummary({
      users: 10,
      listings: 4,
      payments: 3,
      pendingListings: 1,
      pendingPayments: 1,
      approvedListings: 2,
      approvedPayments: 2,
      revenue: 1250
    });

    expect(summary.totalUsers).toBe(10);
    expect(summary.totalListings).toBe(4);
    expect(summary.totalRevenue).toBe(1250);
    expect(summary.approvalRate).toBeGreaterThan(0);
  });
});
