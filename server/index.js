require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/addons', require('./routes/addons'));
app.use('/api/partner', require('./routes/partner'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Serve Angular in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist/logistics-auction/browser');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Setup WebSocket
setupSocket(io);

const PORT = process.env.PORT || 3000;

syncDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startAuctionCron(io);
  });
}).catch(err => {
  console.error('DB sync failed:', err);
  process.exit(1);
});
