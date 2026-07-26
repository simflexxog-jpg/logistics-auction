const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, RefreshToken } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/auditLog');

const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh_secret_key';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || 30; // days

/**
 * Helper: Generate tokens
 */
const generateTokens = (userId, userRole) => {
  const accessToken = jwt.sign({ id: userId, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

// Register
router.post('/register', authLimiter, auditLog('CREATE', 'User'), asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, truckType, truckCapacity, licensePlate, orgId } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing required fields' });

  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(400).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name, email, password: hashed, role, phone, orgId,
    ...(role === 'partner' ? { truckType, truckCapacity, licensePlate } : {})
  });

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  
  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY);
  await RefreshToken.create({
    userId: user.id,
    token: refreshToken,
    expiresAt,
  });

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
}));

// Login
router.post('/login', authLimiter, auditLog('READ', 'User'), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  
  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY);
  await RefreshToken.create({
    userId: user.id,
    token: refreshToken,
    expiresAt,
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating }
  });
}));

// Refresh token endpoint
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

  // Verify refresh token exists in database and not revoked
  const storedToken = await RefreshToken.findOne({
    where: { token: refreshToken, revokedAt: null }
  });
  
  if (!storedToken || new Date() > storedToken.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
    
    // Revoke old refresh token and create new one
    await storedToken.update({ revokedAt: new Date() });
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY);
    await RefreshToken.create({
      userId: user.id,
      token: newRefreshToken,
      expiresAt,
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
}));

// Logout - revoke refresh token
router.post('/logout', auth, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (refreshToken) {
    await RefreshToken.update(
      { revokedAt: new Date() },
      { where: { token: refreshToken } }
    );
  }

  res.json({ message: 'Logged out successfully' });
}));

module.exports = router;
