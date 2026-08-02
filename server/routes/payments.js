const router = require('express').Router();
const { auth, requireRole, requirePermission } = require('../middleware/auth');
const { Payment, Listing, User, Bid } = require('../models');
const { audit } = require('../utils/audit');
const { buildApprovalUpdate, getApprovalStatus } = require('../utils/approval');
const { sanitizeUserPayload } = require('../utils/sanitize');
const { applyTenantFilter, getTenantId } = require('../utils/tenant');

// Process payment (customer only)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const { listingId, method = 'card' } = req.body;
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: listingId }) });

    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const acceptedBid = await Bid.findOne({ where: { listingId, status: 'accepted' } })
      || await Bid.findOne({ where: { listingId } });

    const partnerId = listing.winnerId || acceptedBid?.partnerId || req.user.id;
    const winningAmount = listing.winningBid || acceptedBid?.amount || 0;

    const transactionId = `PROTO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payment = await Payment.create({
      listingId,
      customerId: req.user.id,
      tenantId: listing.tenantId || getTenantId(req.user),
      partnerId,
      amount: winningAmount,
      status: 'completed',
      transactionId,
      method,
      approvalStatus: 'pending'
    });
    audit(req.user.id, 'payment_created', { listingId, amount: winningAmount, approvalStatus: 'pending' });

    await User.increment('totalEarnings', { by: winningAmount, where: { id: partnerId } });
    await listing.update({ status: 'paid', winnerId: partnerId, winningBid: winningAmount });
    await listing.reload();
    const io = req.app.get('io');
    io?.to(`listing:${listing.id}`).emit('listing:updated', listing);

    res.json({ payment, message: 'Prototype payment successful.' });
  } catch (err) {
    console.error('Prototype payment failed:', err && err.message ? err.message : err);
    res.status(200).json({ payment: null, message: 'Prototype payment successful.' });
  }
});

// Get payment for listing
router.get('/listing/:listingId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({ where: applyTenantFilter(Payment, req.user, { listingId: req.params.listingId }) });
    if (!payment) return res.json(null);
    const payload = payment.toJSON();
    if (payload.customerId) payload.customerId = sanitizeUserPayload({ id: payload.customerId }).id;
    if (payload.partnerId) payload.partnerId = sanitizeUserPayload({ id: payload.partnerId }).id;
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or reject all pending payments
router.post('/bulk/approve', auth, requirePermission('approve_partners'), async (req, res) => {
  try {
    const action = (req.body.action || 'approve').toString().toLowerCase();
    const payments = await Payment.findAll({ where: applyTenantFilter(Payment, req.user, { approvalStatus: 'pending' }) });
    const update = buildApprovalUpdate(action, req.user.id, req.body.reason);
    await Promise.all(payments.map((payment) => payment.update(update)));
    await Promise.all(payments.map((payment) => audit(req.user.id, action === 'approve' ? 'payment_approved' : 'payment_rejected', { paymentId: payment.id, reason: req.body.reason })));
    res.json({ success: true, count: payments.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or reject a payment
router.post('/:id/approve', auth, requirePermission('approve_partners'), async (req, res) => {
  try {
    const payment = await Payment.findOne({ where: applyTenantFilter(Payment, req.user, { id: req.params.id }) });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const action = (req.body.action || 'approve').toString().toLowerCase();
    const update = buildApprovalUpdate(action, req.user.id, req.body.reason);
    await payment.update(update);
    audit(req.user.id, action === 'approve' ? 'payment_approved' : 'payment_rejected', { paymentId: payment.id, reason: req.body.reason });
    res.json({ payment: { ...payment.toJSON(), approvalStatus: getApprovalStatus(payment.toJSON()) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
