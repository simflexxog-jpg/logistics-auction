const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roles');
const { bidLimiter } = require('../middleware/rateLimit');
const { auditLog } = require('../middleware/auditLog');
const asyncHandler = require('../utils/asyncHandler');
const { Bid, Listing, User, Payment } = require('../models');

// Place a bid (partner only) - with rate limiting and audit log
router.post('/', auth, roleGuard(['partner', 'CARRIER']), bidLimiter, auditLog('CREATE', 'Bid'), asyncHandler(async (req, res) => {
  const { listingId, amount, note } = req.body;
  const listing = await Listing.findByPk(listingId);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'open') return res.status(400).json({ error: 'Auction is closed' });
  if (new Date(listing.auctionEndsAt) < new Date()) return res.status(400).json({ error: 'Auction has ended' });

  // Multi-tenancy: Ensure user is in the same org or org-agnostic
  if (req.orgId && listing.orgId && req.orgId !== listing.orgId) {
    return res.status(403).json({ error: 'Access denied - different organization' });
  }

  // Check for existing bid
  const existing = await Bid.findOne({ where: { listingId, partnerId: req.user.id } });
  if (existing) {
    await existing.update({ amount, note });
    const updated = await existing.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });
    // Emit via socket
    req.app.get('io')?.to(`listing:${listingId}`).emit('bid:updated', updated);
    return res.json(updated);
  }

  const bid = await Bid.create({ 
    listingId, 
    partnerId: req.user.id, 
    amount, 
    note,
    orgId: req.orgId // Multi-tenancy
  });
  
  const full = await bid.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });

  req.app.get('io')?.to(`listing:${listingId}`).emit('bid:new', full);
  res.status(201).json(full);
}));

// Get my bids (partner)
router.get('/my', auth, roleGuard(['partner', 'CARRIER']), asyncHandler(async (req, res) => {
  // Multi-tenancy: Filter by orgId
  const where = { partnerId: req.user.id };
  if (req.orgId) {
    where.orgId = req.orgId;
  }
  
  const bids = await Bid.findAll({
    where,
    include: [{ model: Listing, include: [{ model: Payment, as: 'payment' }] }],
    order: [['createdAt', 'DESC']]
  });
  res.json(bids);
}));

module.exports = router;
