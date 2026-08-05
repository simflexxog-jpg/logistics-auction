require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const promClient = require('prom-client');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { syncDB } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { globalLimiter, bidLimiter } = require('./middleware/rateLimiter');
const { auctionQueue } = require('./queues/auctionQueue');
const { startAuctionCron } = require('./cron');
const { buildHealthPayload, exportBackup } = require('./utils/ops');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true
  }
});

app.set('io', io);

// Middleware
app.set('redis', redis);
app.set('auctionQueue', auctionQueue);
// Security middlewares
app.use(helmet({
  // set stronger content security policy in production
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:4200'],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  } : false,
}));

// Allow only configured frontend origin
const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:4200';
app.use(cors({ origin: corsOrigin, credentials: true }));

// Request ID middleware
const requestId = require('./middleware/requestId');
app.use(requestId);

// Basic rate limiting
const isProduction = process.env.NODE_ENV === 'production';
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
app.use(globalLimiter);
const shouldSkipRateLimit = (req) => {
  if (!isProduction) {
    return true;
  }

  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
};

const limiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
  message: {
    error: 'Too many requests. Please wait a moment and try again.'
  }
});
app.use(limiter);

// Limit JSON body size to reduce risk of large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Lightweight request inspector to catch obvious SQL injection patterns in strings.
// This is not a substitute for prepared statements/ORM protections but helps reject common attack payloads early.
app.use((req, res, next) => {
  const injectorPattern = /(--|;\s*--|;\s*DROP\b|UNION\s+SELECT|\bOR\b\s+1=1|\/\*|\*\/)/i;
  function checkObj(obj) {
    for (const k in obj) {
      const v = obj[k];
      if (typeof v === 'string' && injectorPattern.test(v)) return true;
      if (typeof v === 'object' && v !== null) {
        if (checkObj(v)) return true;
      }
    }
    return false;
  }
  if (checkObj(req.body) || checkObj(req.query) || checkObj(req.params)) {
    logger.warn({ ip: req.ip, path: req.path }, 'Rejected request with suspicious payload');
    return res.status(400).json({ error: 'Invalid request payload' });
  }
  next();
});

// Enforce valid IDs for params that look like ids (id, listingId, userId, etc.)
app.use((req, res, next) => {
  for (const key of Object.keys(req.params || {})) {
    if (/id$/i.test(key)) {
      const val = req.params[key];
      if (/^[0-9]+$/.test(val)) {
        // coerce numeric IDs to number for downstream handlers
        req.params[key] = parseInt(val, 10);
      } else if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)) {
        // Allow UUIDs as valid identifier strings
      } else {
        return res.status(400).json({ error: 'Invalid identifier in URL path' });
      }
    }
  }
  next();
});

// Initialize metrics
try {
  promClient.collectDefaultMetrics();
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.send(await promClient.register.metrics());
  });
} catch (e) {
  console.warn('Prometheus metrics init failed:', e && e.message);
}

// Initialize passport for OAuth
app.use(passport.initialize());

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/bids', bidLimiter, require('./routes/bids'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/addons', require('./routes/addons'));
app.use('/api/partner', require('./routes/partner'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/oauth'));

// Health check
app.get('/api/health', (req, res) => res.json(buildHealthPayload()));

// Backup export endpoint
app.post('/api/admin/backup', (req, res) => {
  try {
    const filePath = exportBackup();
    res.json({ success: true, path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve Angular in production
if (process.env.NODE_ENV === 'production') {
  let distPath = path.join(__dirname, '../dist/logistics-auction');
  const browserPath = path.join(distPath, 'browser');
  if (fs.existsSync(browserPath)) {
    distPath = browserPath;
  }
  if (fs.existsSync(distPath)) {
    logger.info({ distPath }, 'Serving static from');
    app.use(express.static(distPath));
    app.get('/*splat', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  } else {
    logger.warn({ distPath }, 'Dist folder not found - make sure to run `npm run build` before starting in production.');
  }
}

// Setup WebSocket
setupSocket(io);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await syncDB();
    console.log('Database synced');
  } catch (err) {
    console.error('DB sync failed:', err);
    console.warn('Continuing without DB. API endpoints will fail until DB is available.');
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    try { startAuctionCron(io); } catch (e) { console.warn('Auction cron failed to start:', e && e.message); }
    // Telemetry: Prometheus metrics exposed at /metrics
  });
})();