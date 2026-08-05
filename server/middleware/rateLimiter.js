const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

const isProduction = process.env.NODE_ENV === 'production';

// Use Redis store only when Redis client is ready; otherwise fall back to memory store
let globalStore;
try {
  if (redis && redis.status === 'ready') {
    globalStore = new RedisStore({ client: redis });
  }
} catch (e) {
  globalStore = undefined;
}

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isProduction,
  store: globalStore,
  message: { error: 'Too many requests. Please wait.' },
});

let bidStore;
try {
  if (redis && redis.status === 'ready') {
    bidStore = new RedisStore({ client: redis });
  }
} catch (e) {
  bidStore = undefined;
}

const bidLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: bidStore,
  message: { error: 'Too many bids. Please wait.' },
});

module.exports = { globalLimiter, bidLimiter };
