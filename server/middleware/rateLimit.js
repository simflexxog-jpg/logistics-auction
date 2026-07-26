const rateLimit = require('express-rate-limit');

/**
 * Rate limiters for different endpoints
 * Helps prevent abuse and DDoS attacks
 */

// Strict rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Uses default key generator which properly handles IPv6
  skip: (req) => {
    // Skip rate limiting for non-auth requests
    return !req.path.includes('/auth');
  }
});

// Moderate rate limit for bidding (prevent bid spam)
const bidLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 bids per minute
  message: 'Too many bid attempts, please wait before placing another bid',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/health';
  }
});

module.exports = { authLimiter, bidLimiter, apiLimiter };
