const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Listing, Bid, User, Payment } = require('../models');
const { Op } = require('sequelize');

// Get all open listings (partner can see all, customer sees their own)
router.get('/', auth, async (req, res) => {
  try {
    const where = req.user.role === 'customer'
      ? { customerId: req.user.id }
      : { status: { [Op.in]: ['open', 'auction_ended'] } };
    const listings = await Listing.findAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        { model: Bid, as: 'bids', include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single listing
router.get('/:id', auth, async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id, {
      include: [
        { model: User, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Bid, as: 'bids', include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }], order: [['amount', 'ASC']] },
        { model: Payment, as: 'payment' }
      ]
    });
    if (!listing) return res.status(404).json({ error: 'Not found' });
    res.json(listing);
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
      auctionEndsAt, auctionDuration, auctionDurationHours, isAddOnEligible, maxAddOnWeight } = req.body;

    const durationHours = Number(auctionDurationHours ?? auctionDuration ?? 24);
    const computedAuctionEndsAt = auctionEndsAt || new Date(Date.now() + durationHours * 3600000).toISOString();

    const listing = await Listing.create({
      customerId: req.user.id, title, description, cargoType, weight, dimensions,
      pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng,
      auctionEndsAt: computedAuctionEndsAt, isAddOnEligible, maxAddOnWeight
    });
    res.status(201).json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a bid (customer only) — after auction ends
router.post('/:id/accept-bid', auth, requireRole('customer'), async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
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
    const listing = await Listing.findByPk(req.params.id);
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'paid') return res.status(400).json({ error: 'Shipment must be paid before pickup' });

    await listing.update({ status: 'picked_up' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start transit (partner)
router.post('/:id/start-transit', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'picked_up') return res.status(400).json({ error: 'Shipment must be picked up before transit' });

    await listing.update({ status: 'in_transit' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark delivered (partner)
router.post('/:id/deliver', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'in_transit') return res.status(400).json({ error: 'Shipment must be in transit to complete delivery' });
    await listing.update({ status: 'delivered' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
