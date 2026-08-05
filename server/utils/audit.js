const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const auditFile = path.join(logDir, 'audit.log');

function audit(userId, action, details = {}) {
  const entry = {
    ts: new Date().toISOString(),
    userId: userId || null,
    action,
    details
  };
  try {
    fs.appendFileSync(auditFile, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.warn('Audit log write failed:', e && e.message);
  }
}

module.exports = { audit };
