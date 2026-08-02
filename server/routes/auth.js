const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { auth } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { getEffectivePermissions } = require('../utils/permissions');
const { getTenantId } = require('../utils/tenant');

const JWT_SECRET = process.env.JWT_SECRET || 'logistics_secret_key';

function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role, tenantId: getTenantId(user) }, JWT_SECRET, { expiresIn: '7d' });
}

function generateMfaCode(secret, userId) {
  return crypto.createHmac('sha256', secret).update(userId).digest('hex').slice(0, 6);
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, truckType, truckCapacity, licensePlate, adminCode, tenantId, organizationId, companyId } = req.body;
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
      tenantId: tenantId || organizationId || companyId || 'default',
      organizationId,
      companyId,
      isAdmin: !!isAdmin,
      permissions: isAdmin ? ['manage_users', 'approve_partners', 'view_audit_logs', 'manage_authentication'] : [],
      ...(finalRole === 'partner' ? { truckType, truckCapacity, licensePlate, isVerified: false } : {})
    });

    audit(user.id, 'register', { role: user.role, isAdmin: user.isAdmin });
    const token = createToken(user);
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
    if (!valid) {
      audit(user.id, 'login_failed', { reason: 'invalid_password' });
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.mfaEnabled) {
      const mfaCode = (req.body.mfaCode || '').toString();
      if (!mfaCode) {
        return res.status(401).json({ error: 'MFA code required' });
      }

      const expected = generateMfaCode(user.mfaSecret, user.id);
      if (mfaCode !== expected) {
        audit(user.id, 'login_failed', { reason: 'invalid_mfa' });
        return res.status(401).json({ error: 'Invalid MFA code' });
      }
    }

    audit(user.id, 'login_success', { role: user.role });
    const token = createToken(user);
    const permissions = getEffectivePermissions({ role: user.role, permissions: user.permissions || [] });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating, isAdmin: user.isAdmin, tenantId: getTenantId(user), permissions } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set up MFA for the current user
router.post('/mfa/setup', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = crypto.randomBytes(16).toString('hex');
    user.mfaSecret = secret;
    user.mfaEnabled = false;
    await user.save();

    res.json({ secret, code: generateMfaCode(secret, user.id), message: 'Store the secret securely and verify it with the generated code.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enable MFA for the current user
router.post('/mfa/verify', auth, async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaSecret) return res.status(400).json({ error: 'MFA setup not initialized' });

    const expected = generateMfaCode(user.mfaSecret, user.id);
    if ((code || '').toString() !== expected) {
      audit(user.id, 'mfa_verify_failed', {});
      return res.status(401).json({ error: 'Invalid MFA code' });
    }

    user.mfaEnabled = true;
    await user.save();
    audit(user.id, 'mfa_enabled', {});
    res.json({ success: true, mfaEnabled: true });
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
    const permissions = getEffectivePermissions({ role: user.role, permissions: user.permissions || [] });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, avgRating: user.avgRating, isAdmin: user.isAdmin, tenantId: getTenantId(user), permissions, mfaEnabled: !!user.mfaEnabled });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

