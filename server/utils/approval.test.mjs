import { describe, expect, it } from 'vitest';
import { normalizeApprovalStatus, getApprovalStatus, buildApprovalUpdate } from './approval.js';

describe('approval helpers', () => {
  it('normalizes valid statuses', () => {
    expect(normalizeApprovalStatus('APPROVED')).toBe('approved');
    expect(normalizeApprovalStatus('unknown', 'pending')).toBe('pending');
  });

  it('derives approval state from records', () => {
    expect(getApprovalStatus({ isApproved: true })).toBe('approved');
    expect(getApprovalStatus({ isApproved: false })).toBe('rejected');
    expect(getApprovalStatus({})).toBe('pending');
  });

  it('builds review updates for admin actions', () => {
    const update = buildApprovalUpdate('approve', 'admin-1', '');
    expect(update.approvalStatus).toBe('approved');
    expect(update.reviewedBy).toBe('admin-1');
    expect(update.rejectionReason).toBeNull();
  });
});
