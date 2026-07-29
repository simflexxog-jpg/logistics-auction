const router = require('express').Router();
const { auth, requireAdmin } = require('../middleware/auth');
const { User } = require('../models');
const { audit } = require('../utils/audit');
const nodemailer = require('nodemailer');

async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_HOST) {
    console.log('SMTP not configured, skipping email to', to, 'subject:', subject);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@example.com', to, subject, text });
}

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

// Notify partner (email)
router.post('/partners/:id/notify', auth, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const u = await User.findByPk(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    await sendEmail(u.email, 'Platform notification', message || 'Please verify your account');
    audit(req.user.id, 'notify_partner', { partnerId: u.id, message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all users (with optional search)
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const q = (req.query.q || '').toString();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 1000);
    const sort = (req.query.sort || 'createdAt').toString();
    const order = (req.query.order || 'desc').toString().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const Op = require('sequelize').Op;
    const where = q ? { [Op.or]: [
      { name: { [Op.iLike]: `%${q}%` } },
      { email: { [Op.iLike]: `%${q}%` } }
    ] } : {};
    const offset = (page - 1) * limit;
    const result = await User.findAndCountAll({ where, attributes: { exclude: ['password'] }, limit, offset, order: [[sort, order]] });
    res.json({ rows: result.rows, count: result.count, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read audit log (tail)
router.get('/audit', auth, requireAdmin, async (req, res) => {
  try {
    const lines = parseInt(req.query.lines || '200', 10) || 200;
    const actionFilter = (req.query.action || '').toString().toLowerCase();
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    const logPath = require('path').join(__dirname, '..', 'logs', 'audit.log');
    if (!require('fs').existsSync(logPath)) return res.json([]);
    const data = require('fs').readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch(e){ return { raw: l }; } });
    let filtered = data;
    if (actionFilter) filtered = filtered.filter(x => (x.action || '').toString().toLowerCase().includes(actionFilter));
    if (from) filtered = filtered.filter(x => new Date(x.timestamp || x.time || x.createdAt).getTime() >= from.getTime());
    if (to) filtered = filtered.filter(x => new Date(x.timestamp || x.time || x.createdAt).getTime() <= to.getTime());
    const tail = filtered.slice(-lines);
    res.json(tail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
