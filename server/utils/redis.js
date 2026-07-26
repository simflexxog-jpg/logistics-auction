const Redis = require('ioredis');

/**
 * Redis client for:
 * - Query result caching
 * - Socket.io scaling via redis adapter
 * - Session management
 */

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableOfflineQueue: false,
});

redis.on('error', (err) => {
  console.error('Redis error:', err.message);
  console.warn('Continuing without Redis. Caching and Socket.io scaling will be disabled.');
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

/**
 * Generic cache get/set with TTL
 */
const cache = {
  get: async (key) => {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Cache get error:', err.message);
      return null;
    }
  },

  set: async (key, value, ttl = 3600) => {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (err) {
      console.error('Cache set error:', err.message);
    }
  },

  del: async (key) => {
    try {
      await redis.del(key);
    } catch (err) {
      console.error('Cache del error:', err.message);
    }
  },

  clear: async () => {
    try {
      await redis.flushdb();
    } catch (err) {
      console.error('Cache clear error:', err.message);
    }
  },
};

module.exports = { redis, cache };
