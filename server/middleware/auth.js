const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { getEffectivePermissions, hasPermission } = require('../utils/permissions');
const { audit } = require('../utils/audit');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'logistics_secret_key');
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const permissions = getEffectivePermissions({
      role: user.role,
      permissions: user.permissions || []
    });

    req.user = user;
    req.user.permissions = permissions;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err && err.message ? err.message : err);
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(401).json({ error: err.message || 'Invalid token' });
    }
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) return res.status(403).json({ error: 'Access denied' });
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || (!req.user.isAdmin && !hasPermission(req.user, 'manage_users'))) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user || !hasPermission(req.user, permission)) {
    audit(req.user?.id || null, 'permission_denied', { permission, path: req.path });
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireVerifiedPartner = (req, res, next) => {
  if (!req.user || req.user.role !== 'partner') return res.status(403).json({ error: 'Partner access required' });
  if (!req.user.isVerified) return res.status(403).json({ error: 'Partner account not verified' });
  next();
};

module.exports = { auth, requireRole, requireAdmin, requirePermission, requireVerifiedPartner };
