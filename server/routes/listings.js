const router = require('express').Router();
const { auth, requireRole, requirePermission } = require('../middleware/auth');
const { Listing, Bid, User, Payment, AddOn } = require('../models');
const { Op } = require('sequelize');
const { audit } = require('../utils/audit');
const { buildApprovalUpdate, getApprovalStatus } = require('../utils/approval');
const { sanitizeUserPayload } = require('../utils/sanitize');
const { applyTenantFilter, getTenantId } = require('../utils/tenant');

// Get all open listings (partner can see all, customer sees their own)
router.get('/', auth, async (req, res) => {
  try {
    const baseWhere = req.user.role === 'customer'
      ? { customerId: req.user.id }
      : { status: { [Op.in]: ['open', 'auction_ended'] } };
    if (req.user.role !== 'customer' && !req.user.isAdmin) {
      baseWhere.approvalStatus = 'approved';
    }
    const where = applyTenantFilter(Listing, req.user, baseWhere);
    const listings = await Listing.findAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        { model: Bid, as: 'bids', include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    const sanitized = listings.map((listing) => {
      const item = listing.toJSON();
      if (item.customer) item.customer = sanitizeUserPayload(item.customer);
      if (Array.isArray(item.bids)) {
        item.bids = item.bids.map((bid) => ({ ...bid, partner: bid.partner ? sanitizeUserPayload(bid.partner) : null }));
      }
      return item;
    });
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single listing
router.get('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findOne({
      where: applyTenantFilter(Listing, req.user, { id: req.params.id }),
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Bid, as: 'bids', include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }], order: [['amount', 'ASC']] },
        { model: Payment, as: 'payment' }
      ]
    });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    const payload = listing.toJSON();
    if (payload.customer) payload.customer = sanitizeUserPayload(payload.customer);
    if (Array.isArray(payload.bids)) {
      payload.bids = payload.bids.map((bid) => ({ ...bid, partner: bid.partner ? sanitizeUserPayload(bid.partner) : null }));
    }
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create listing (customer only)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const { title, description, cargoType, weight, dimensions,
      pickupAddress, pickupLat, pickupLng,
      dropoffAddress, dropoffLat, dropoffLng,
      auctionEndsAt, auctionDuration, auctionDurationHours, isAddOnEligible, maxAddOnWeight, price } = req.body;

    const parsedWeight = Number(weight);
    const durationHours = Number(auctionDurationHours ?? auctionDuration ?? 24);
    const computedAuctionEndsAt = auctionEndsAt || new Date(Date.now() + durationHours * 3600000).toISOString();

    if (Number.isFinite(parsedWeight) && parsedWeight < 100) {
      const addon = await AddOn.create({
        customerId: req.user.id,
        title,
        description,
        weight: parsedWeight,
        pickupAddress,
        pickupLat,
        pickupLng,
        dropoffAddress,
        dropoffLat,
        dropoffLng,
        price: Number(price || 0),
        status: 'open'
      });

      return res.status(201).json({
        message: 'This shipment is under 100kg, so it has been posted as an add-on shipment instead of a main listing.',
        addon
      });
    }

    const listing = await Listing.create({
      customerId: req.user.id, tenantId: getTenantId(req.user), title, description, cargoType, weight, dimensions,
      pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng,
      auctionEndsAt: computedAuctionEndsAt, isAddOnEligible, maxAddOnWeight,
      approvalStatus: 'pending'
    });
    audit(req.user.id, 'listing_created', { listingId: listing.id, approvalStatus: 'pending' });
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a bid (customer only) — after auction ends
router.post('/:id/accept-bid', auth, requireRole('customer'), async (req, res) => {
  try {
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: req.params.id }) });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    if (listing.customerId !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
    if (listing.status !== 'auction_ended') return res.status(400).json({ error: 'Auction still open' });

    const { bidId } = req.body;
    const bid = await Bid.findByPk(bidId);
    if (!bid || bid.listingId !== listing.id) return res.status(400).json({ error: 'Invalid bid' });

    await listing.update({ status: 'accepted', winnerId: bid.partnerId, winningBid: bid.amount });
    await bid.update({ status: 'accepted' });
    await Bid.update({ status: 'lost' }, { where: { listingId: listing.id, id: { [Op.ne]: bidId } } });

    res.json({ listing, bid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark pickup (partner)
router.post('/:id/pickup', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: req.params.id }) });
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'paid') return res.status(400).json({ error: 'Shipment must be paid before pickup' });

    await listing.update({ status: 'picked_up' });
    await listing.reload();
    const io = req.app.get('io');
    io?.to(`listing:${listing.id}`).emit('listing:updated', listing);
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start transit (partner)
router.post('/:id/start-transit', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: req.params.id }) });
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'picked_up') return res.status(400).json({ error: 'Shipment must be picked up before transit' });

    await listing.update({ status: 'in_transit' });
    await listing.reload();
    const io = req.app.get('io');
    io?.to(`listing:${listing.id}`).emit('listing:updated', listing);
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark delivered (partner)
router.post('/:id/deliver', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: req.params.id }) });
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'in_transit') return res.status(400).json({ error: 'Shipment must be in transit to complete delivery' });
    await listing.update({ status: 'delivered' });
    await listing.reload();
    const io = req.app.get('io');
    io?.to(`listing:${listing.id}`).emit('listing:updated', listing);
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or reject all pending listings
router.post('/bulk/approve', auth, requirePermission('approve_partners'), async (req, res) => {
  try {
    const action = (req.body.action || 'approve').toString().toLowerCase();
    const listings = await Listing.findAll({ where: applyTenantFilter(Listing, req.user, { approvalStatus: 'pending' }) });
    const update = buildApprovalUpdate(action, req.user.id, req.body.reason);
    await Promise.all(listings.map((listing) => listing.update(update)));
    await Promise.all(listings.map((listing) => audit(req.user.id, action === 'approve' ? 'listing_approved' : 'listing_rejected', { listingId: listing.id, reason: req.body.reason })));
    res.json({ success: true, count: listings.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve or reject a listing
router.post('/:id/approve', auth, requirePermission('approve_partners'), async (req, res) => {
  try {
    const listing = await Listing.findOne({ where: applyTenantFilter(Listing, req.user, { id: req.params.id }) });
    if (!listing) return res.status(404).json({ error: 'Not found' });

    const action = (req.body.action || 'approve').toString().toLowerCase();
    const update = buildApprovalUpdate(action, req.user.id, req.body.reason);
    await listing.update(update);
    audit(req.user.id, action === 'approve' ? 'listing_approved' : 'listing_rejected', { listingId: listing.id, reason: req.body.reason });
    res.json({ listing: { ...listing.toJSON(), approvalStatus: getApprovalStatus(listing.toJSON()) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
