const pino = require('pino');
const pretty = require('pino-pretty');

const transport = process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined;

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport,
});

module.exports = logger;
