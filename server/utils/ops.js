const fs = require('fs');
const path = require('path');

function buildHealthPayload() {
  const memory = process.memoryUsage();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    pid: process.pid,
    memory: {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

function exportBackup() {
  const backupDir = path.join(__dirname, '..', '..', 'logs');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = `backup-${Date.now()}.json`;
  const filePath = path.join(backupDir, fileName);
  const payload = {
    exportedAt: new Date().toISOString(),
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

module.exports = {
  buildHealthPayload,
  exportBackup
};
