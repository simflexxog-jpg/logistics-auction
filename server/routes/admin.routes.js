const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { adminGuard } = require('../middleware/tierGuards');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { CarrierProfile, Shipment, AuditLog, User } = require('../models');
const { CARRIER_VERIFICATION_STATUS } = require('../constants');

// GET /api/admin/carrier-profiles
router.get('/carrier-profiles', auth, adminGuard, asyncHandler(async (req, res) => {
  const profiles = await CarrierProfile.findAll({
    where: { orgId: req.orgId },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
  });
  res.json(profiles);
}));

// PATCH /api/admin/carrier-profiles/:id/verification-status
router.patch('/carrier-profiles/:id/verification-status', auth, adminGuard, auditLog('UPDATE', 'CarrierProfile'), asyncHandler(async (req, res) => {
  const profile = await CarrierProfile.findByPk(req.params.id);
  if (!profile) return res.status(404).json({ error: 'Carrier profile not found' });
  if (profile.orgId !== req.orgId) return res.status(403).json({ error: 'Access denied' });

  const { status } = req.body;
  if (!Object.values(CARRIER_VERIFICATION_STATUS).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  await profile.update({ verificationStatus: status });
  res.json(profile);
}));

// GET /api/admin/disputes
router.get('/disputes', auth, adminGuard, asyncHandler(async (req, res) => {
  const disputes = await Shipment.findAll({
    where: { status: 'DISPUTED', orgId: req.orgId },
    include: [
      { association: 'customer', attributes: ['id', 'name'] },
      { association: 'carrier', attributes: ['id', 'name'] }
    ]
  });
  res.json(disputes);
}));

// GET /api/admin/audit-logs
router.get('/audit-logs', auth, adminGuard, asyncHandler(async (req, res) => {
  const logs = await AuditLog.findAll({
    where: { orgId: req.orgId },
    order: [['createdAt', 'DESC']],
    limit: 200
  });
  res.json(logs);
}));

module.exports = router;
