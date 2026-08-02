const DEFAULT_ADMIN_PERMISSIONS = [
  'manage_users',
  'approve_partners',
  'view_audit_logs',
];

function normalizePermissions(user = {}) {
  const role = String(user.role || '').toLowerCase();
  const explicitPermissions = Array.isArray(user.permissions) ? user.permissions : [];

  if (role === 'admin') {
    return [...new Set([...DEFAULT_ADMIN_PERMISSIONS, ...explicitPermissions])];
  }

  return [...new Set(explicitPermissions)];
}

function hasPermission(user = {}, permission) {
  return normalizePermissions(user).includes(permission);
}

function getEffectivePermissions(user = {}) {
  return normalizePermissions(user);
}

module.exports = {
  normalizePermissions,
  hasPermission,
  getEffectivePermissions,
  default: {
    normalizePermissions,
    hasPermission,
    getEffectivePermissions,
  },
};
