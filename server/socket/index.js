const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';
const logger = require('../config/logger');
const redis = require('../config/redis');
const { createAdapter } = require('@socket.io/redis-adapter');

module.exports = (io) => {
  try {
    if (redis && redis.status === 'ready') {
      const pub = redis;
      const sub = redis.duplicate ? redis.duplicate() : redis;
      io.adapter(createAdapter(pub, sub));
      logger.info('Socket.IO Redis adapter initialized');
    } else {
      logger.warn('Redis not available; skipping Socket.IO Redis adapter initialization');
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to initialize Socket.IO Redis adapter');
  }

  // Auth middleware for socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ userId: socket.userId }, 'Socket connected');

    // Join a listing room (for auction bids)
    socket.on('join:listing', (listingId) => {
      socket.join(`listing:${listingId}`);
    });

    // Join chat room
    socket.on('join:chat', (listingId) => {
      socket.join(`chat:${listingId}`);
    });

    // Typing indicator
    socket.on('chat:typing', ({ listingId, name }) => {
      socket.to(`chat:${listingId}`).emit('chat:typing', { name });
    });

    socket.on('disconnect', () => {
      logger.info({ userId: socket.userId }, 'Socket disconnected');
    });
  });
};
