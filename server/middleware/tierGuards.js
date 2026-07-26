const { ROLES } = require('../constants');

/**
 * CustomerGuard - ensures user is a CUSTOMER/SHIPPER
 */
const customerGuard = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const validRoles = [ROLES.CUSTOMER, ROLES.CUSTOMER_LEGACY];
  if (!validRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This resource is only for customers (SHIPPER role)'
    });
  }

  next();
};

/**
 * CarrierGuard - ensures user is a CARRIER/PARTNER
 */
const carrierGuard = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const validRoles = [ROLES.CARRIER, ROLES.PARTNER_LEGACY];
  if (!validRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This resource is only for carriers (CARRIER role)'
    });
  }

  next();
};

/**
 * AdminGuard - ensures user is ADMIN
 */
const adminGuard = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'This resource is only for admins'
    });
  }

  next();
};

module.exports = { customerGuard, carrierGuard, adminGuard };
