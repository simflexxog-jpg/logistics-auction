const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

const isProduction = process.env.NODE_ENV === 'production';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !isProduction,
  store: new RedisStore({ client: redis }),
  message: { error: 'Too many requests. Please wait.' },
});

const bidLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 seconds
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({ client: redis }),
  message: { error: 'Too many bids. Please wait.' },
});

module.exports = { globalLimiter, bidLimiter };
