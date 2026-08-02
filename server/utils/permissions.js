const ADMIN_DEFAULT_PERMISSIONS = [
  'manage_users',
  'approve_partners',
  'view_audit_logs',
  'manage_authentication'
];

function normalizePermissions(user = {}) {
  const role = (user.role || '').toString().toLowerCase();
  if (role === 'admin') {
    return Array.from(new Set([...ADMIN_DEFAULT_PERMISSIONS, ...(user.permissions || [])]));
  }

  const permitted = Array.isArray(user.permissions) ? user.permissions : [];
  return permitted.map((permission) => permission.toString().trim()).filter(Boolean);
}

function getEffectivePermissions(user = {}) {
  return normalizePermissions(user);
}

function hasPermission(user = {}, permission) {
  if (!permission) return true;
  const perms = getEffectivePermissions(user);
  return perms.includes(permission.toString());
}

module.exports = { ADMIN_DEFAULT_PERMISSIONS, normalizePermissions, getEffectivePermissions, hasPermission };
