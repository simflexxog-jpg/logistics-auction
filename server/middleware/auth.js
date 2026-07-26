const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);
    
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    // Attach user and orgId to request for multi-tenancy scoping
    req.user = user;
    req.orgId = user.orgId;
    
    next();
  } catch (err) {
    console.error('Auth middleware error:', err && err.message ? err.message : err);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (process.env.NODE_ENV === 'production') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(401).json({ error: err.message || 'Invalid token' });
    }
  }
};

/**
 * Single role check (deprecated - use roleGuard from roles.js instead)
 */
const requireRole = (role) => (req, res, next) => {
  if (req.user.role !== role) return res.status(403).json({ error: 'Access denied' });
  next();
};

module.exports = { auth, requireRole };
