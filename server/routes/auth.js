const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

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

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, isAdmin: user.isAdmin } });
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

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

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

