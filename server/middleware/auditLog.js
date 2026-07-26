const { AuditLog } = require('../models');

/**
 * Audit logging middleware for tracking state-changing operations
 * Logs CREATE, UPDATE, DELETE actions to AuditLog table
 */

const auditLog = (action, entity, getEntityId = null) => {
  return async (req, res, next) => {
    // Intercept the response to log after success
    const originalJson = res.json.bind(res);

    res.json = function(data) {
      // Only log on successful responses (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        (async () => {
          try {
            let entityId = null;
            if (typeof getEntityId === 'function') {
              entityId = getEntityId(req, data);
            } else if (data?.id) {
              entityId = data.id;
            }

            await AuditLog.create({
              userId: req.user?.id,
              action,
              entity,
              entityId,
              metadata: {
                method: req.method,
                path: req.path,
                userAgent: req.get('user-agent'),
                ip: req.ip,
                requestBody: req.body,
              },
              orgId: req.user?.orgId,
            });
          } catch (err) {
            console.error('Audit log error:', err.message);
            // Don't block the response if audit logging fails
          }
        })();
      }

      return originalJson(data);
    };

    next();
  };
};

module.exports = { auditLog };
