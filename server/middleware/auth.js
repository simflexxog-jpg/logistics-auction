const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { hasPermission } = require('../utils/permissions');
const logger = require('../config/logger');
const redis = require('../config/redis');
const requireRole = require('./rbac');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    // Check blacklist in Redis
    try {
      const black = await redis.get(`bl:access:${token}`);
      if (black) return res.status(401).json({ error: 'Token revoked' });
    } catch (e) {
      logger.warn({ err: e }, 'Failed checking token blacklist');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'logistics_secret_key');
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(401).json({ error: err.message || 'Invalid token' });
    }
  }
};

// `requireRole` is provided by middleware/rbac and supports multiple roles

const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireVerifiedPartner = (req, res, next) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : (req.user?.role ? [req.user.role] : []);
  if (!req.user || !roles.includes('partner')) return res.status(403).json({ error: 'Partner access required' });
  if (!req.user.isVerified) return res.status(403).json({ error: 'Partner account not verified' });
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.isAdmin || hasPermission(req.user, permission)) {
    return next();
  }
  return res.status(403).json({ error: 'Permission denied' });
};

module.exports = { auth, requireRole, requireAdmin, requirePermission, requireVerifiedPartner };
