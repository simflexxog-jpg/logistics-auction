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
const setupSocket = require('./socket');
const { startAuctionCron } = require('./cron');

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
// Security middlewares
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Basic rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
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
    console.warn('Rejected request with suspicious payload from', req.ip, 'path', req.path);
    return res.status(400).json({ error: 'Invalid request payload' });
  }
  next();
});

// Enforce numeric IDs for params that look like ids (id, listingId, userId, etc.)
app.use((req, res, next) => {
  for (const key of Object.keys(req.params || {})) {
    if (/id$/i.test(key)) {
      const val = req.params[key];
      if (!/^[0-9]+$/.test(val)) {
        return res.status(400).json({ error: 'Invalid identifier in URL path' });
      }
      // coerce to number for downstream handlers
      req.params[key] = parseInt(val, 10);
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
app.use('/api/bids', require('./routes/bids'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/addons', require('./routes/addons'));
app.use('/api/partner', require('./routes/partner'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/auth', require('./routes/oauth'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve Angular in production
if (process.env.NODE_ENV === 'production') {
  let distPath = path.join(__dirname, '../dist/logistics-auction');
  const browserPath = path.join(distPath, 'browser');
  if (fs.existsSync(browserPath)) {
    distPath = browserPath;
  }
  if (fs.existsSync(distPath)) {
    console.log('Serving static from', distPath);
    app.use(express.static(distPath));
    app.get('/*splat', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  } else {
    console.warn('Dist folder not found at', distPath, '- make sure to run `npm run build` before starting in production.');
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