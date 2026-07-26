/**
 * Role-based access control (RBAC) middleware
 * Supports multiple roles and checks if user has at least one required role
 */

const roleGuard = (allowedRoles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const userRole = req.user.role;
  
  if (allowedRoles.length === 0) {
    // No specific roles required, just user authenticated
    return next();
  }

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: `User role '${userRole}' is not authorized for this resource. Required roles: ${allowedRoles.join(', ')}`
    });
  }

  next();
};

module.exports = { roleGuard };
