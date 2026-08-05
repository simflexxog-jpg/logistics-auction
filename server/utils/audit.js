const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const auditFile = path.join(logDir, 'audit.log');
const logger = require('../config/logger');

function audit(userId, action, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    userId: userId || null,
    action,
    details
  };
  try {
    fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
    // Also attempt to write to DB audit_logs table if available
    try {
      const { sequelize } = require('../models');
      if (sequelize) {
        const q = `INSERT INTO audit_logs(id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`;
        const params = [userId || null, action, details.entity_type || null, details.entity_id || null, JSON.stringify(details.old_value || null), JSON.stringify(details.new_value || null), details.ip_address || null];
        // run but don't await (synchronous context) — use sequelize.query returning a promise and ignore errors
        sequelize.query(q, { bind: params }).catch((e) => {
          logger && logger.warn({ err: e }, 'DB audit insert failed');
        });
      }
    } catch (e) {
      // ignore DB insert errors
    }
  } catch (e) {
    logger.warn({ err: e }, 'Audit log write failed');
  }
}

module.exports = { audit };
