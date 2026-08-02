function getTenantId(user = {}) {
  if (!user) return 'default';
  const explicit = user.tenantId || user.organizationId || user.companyId;
  return explicit ? String(explicit) : 'default';
}

function applyTenantFilter(model, user, where = {}) {
  const tenantId = getTenantId(user);
  if (!tenantId || tenantId === 'default') return where;
  return { ...where, tenantId };
}

module.exports = { getTenantId, applyTenantFilter };
