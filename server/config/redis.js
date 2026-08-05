const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';

const redis = new Redis(redisUrl, {
  // sensible defaults; tune for production if needed
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

const logger = require('./logger');
redis.on('error', (err) => {
  logger.warn({ err }, 'Redis error');
});

module.exports = redis;
