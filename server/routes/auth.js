const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const redis = require('../config/redis');
const logger = require('../config/logger');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');

const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, truckType, truckCapacity, licensePlate, adminCode } = req.body;
    // Default role to customer if not provided
    const finalRole = role === 'partner' ? 'partner' : 'customer';
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const isAdmin = adminCode && process.env.ADMIN_SECRET && adminCode === process.env.ADMIN_SECRET;
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: finalRole,
      phone,
      isAdmin: !!isAdmin,
      ...(finalRole === 'partner' ? { truckType, truckCapacity, licensePlate, isVerified: false } : {})
    });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    try {
      const ttl = 7 * 24 * 60 * 60; // 7 days in seconds
      await redis.set(`session:${user.id}:${accessToken}`, '1', 'EX', ttl);
      await RefreshToken.create({ tokenHash: refreshHash, userId: user.id, expiresAt: new Date(Date.now() + ttl * 1000) });
      logger.info({ userId: user.id, action: 'register' }, 'User registered and session cached in Redis');
    } catch (e) {
      logger.warn({ err: e }, 'Failed caching session in Redis after register');
    }
    res.status(201).json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    try {
      const ttl = 7 * 24 * 60 * 60;
      await redis.set(`session:${user.id}:${accessToken}`, '1', 'EX', ttl);
      await RefreshToken.create({ tokenHash: refreshHash, userId: user.id, expiresAt: new Date(Date.now() + ttl * 1000) });
      logger.info({ userId: user.id, action: 'login' }, 'User login cached in Redis');
    } catch (e) {
      logger.warn({ err: e }, 'Failed caching session in Redis after login');
    }
    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Return current user info
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(auth, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating, isAdmin: user.isAdmin });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const rt = await RefreshToken.findOne({ where: { tokenHash: refreshHash } });
    if (!rt || rt.revoked || new Date(rt.expiresAt) < new Date()) return res.status(401).json({ error: 'Invalid refresh token' });
    const user = await User.findByPk(rt.userId);
    if (!user) return res.status(401).json({ error: 'Invalid refresh token' });

    // Issue new access token (and rotate refresh token)
    const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '15m' });
    const newRefresh = crypto.randomBytes(48).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    // Mark old refresh token revoked
    rt.revoked = true;
    await rt.save();
    const ttl = 7 * 24 * 60 * 60;
    await RefreshToken.create({ tokenHash: newHash, userId: user.id, expiresAt: new Date(Date.now() + ttl * 1000) });
    // store access session in redis
    await redis.set(`session:${user.id}:${accessToken}`, '1', 'EX', ttl);
    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    logger.error({ err }, 'Refresh token error');
    res.status(500).json({ error: 'Internal error' });
  }
});

// Logout - revoke refresh token and blacklist access token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const auth = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (refreshToken) {
      const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const rt = await RefreshToken.findOne({ where: { tokenHash: refreshHash } });
      if (rt) { rt.revoked = true; await rt.save(); }
    }
    if (auth) {
      // blacklist access token in redis until it expires
      try {
        const payload = jwt.decode(auth);
        if (payload && payload.exp) {
          const ttl = payload.exp * 1000 - Date.now();
          if (ttl > 0) await redis.set(`bl:access:${auth}`, '1', 'PX', ttl);
        }
      } catch (e) { logger.warn({ err: e }, 'Failed blacklisting access token'); }
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Logout error');
    res.status(500).json({ error: 'Internal error' });
  }
});


