const fs = require('fs');
const path = require('path');
const os = require('os');

function buildHealthPayload() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    nodeVersion: process.version
  };
}

function exportBackup(outputDir = path.join(process.cwd(), 'backups')) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `backup-${timestamp}.json`);
  const payload = {
    exportedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
    health: buildHealthPayload()
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

module.exports = { buildHealthPayload, exportBackup };
