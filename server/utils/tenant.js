function getTenantId(user) {
  return user?.tenantId || 'default';
}

function applyTenantFilter(Model, user, where = {}) {
  const tenantId = getTenantId(user);
  const scope = { ...where };

  if (user?.isAdmin) {
    return scope;
  }

  if (user?.tenantId) {
    scope.tenantId = tenantId;
  }

  return scope;
}

module.exports = {
  getTenantId,
  applyTenantFilter,
};
