import { describe, expect, it } from 'vitest';
import permissionsModule from './permissions.js';

const { normalizePermissions, hasPermission, getEffectivePermissions } = permissionsModule;

describe('permissions helpers', () => {
  it('gives admins the full permission set by default', () => {
    const perms = normalizePermissions({ role: 'admin', permissions: [] });
    expect(getEffectivePermissions({ role: 'admin', permissions: [] })).toEqual(expect.arrayContaining(['manage_users', 'approve_partners', 'view_audit_logs']));
    expect(hasPermission({ role: 'admin', permissions: [] }, 'manage_users')).toBe(true);
  });

  it('respects explicit permissions for non-admin users', () => {
    const user = { role: 'partner', permissions: ['view_audit_logs'] };
    expect(hasPermission(user, 'view_audit_logs')).toBe(true);
    expect(hasPermission(user, 'manage_users')).toBe(false);
  });
});
