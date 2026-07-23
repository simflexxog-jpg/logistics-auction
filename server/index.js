require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

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
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:4200', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting because DB sync failed in production');
      process.exit(1);
    } else {
      console.warn('Continuing without DB (development). API endpoints will fail until DB is available.');
    }
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    try { startAuctionCron(io); } catch (e) { console.warn('Auction cron failed to start:', e && e.message); }
  });
})();