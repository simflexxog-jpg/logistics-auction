import { describe, expect, it } from 'vitest';
import { applyTenantFilter, getTenantId } from './tenant.js';

describe('tenant helpers', () => {
  it('returns a default tenant for anonymous users', () => {
    expect(getTenantId()).toBe('default');
  });

  it('uses an explicit tenant identifier when present', () => {
    expect(getTenantId({ organizationId: 'acme' })).toBe('acme');
  });

  it('adds the tenant to a filter object', () => {
    expect(applyTenantFilter({}, { tenantId: 'acme' }, { role: 'partner' })).toEqual({ role: 'partner', tenantId: 'acme' });
  });
});
