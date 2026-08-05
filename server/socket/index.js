const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';

module.exports = (io) => {
  // Auth middleware for socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
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
    console.log(`Socket connected: ${socket.userId}`);

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
      console.log(`Socket disconnected: ${socket.userId}`);
    });
  });
};
