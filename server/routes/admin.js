const router = require('express').Router();
const { auth, requireAdmin } = require('../middleware/auth');
const { User } = require('../models');
const { audit } = require('../utils/audit');

// List pending partners
router.get('/partners/pending', auth, requireAdmin, async (req, res) => {
  try {
    const pending = await User.findAll({ where: { role: 'partner', isVerified: false }, attributes: { exclude: ['password'] } });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve partner
router.post('/partners/:id/approve', auth, requireAdmin, async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.role !== 'partner') return res.status(400).json({ error: 'User is not a partner' });
    u.isVerified = true;
    await u.save();
    audit(req.user.id, 'approve_partner', { partnerId: u.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject partner (mark not verified and optionally add note)
router.post('/partners/:id/reject', auth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.role !== 'partner') return res.status(400).json({ error: 'User is not a partner' });
    u.isVerified = false;
    await u.save();
    audit(req.user.id, 'reject_partner', { partnerId: u.id, reason });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
