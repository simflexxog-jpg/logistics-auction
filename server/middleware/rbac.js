// requireRole factory
module.exports = (...allowedRoles) => (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const userRoles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
  const has = allowedRoles.some(r => userRoles.includes(r) || user.isAdmin);
  if (!has) return res.status(403).json({ error: 'Forbidden' });
  next();
};
