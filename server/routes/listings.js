const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Listing, Bid, User } = require('../models');
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
        { model: Bid, as: 'bids', include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }], order: [['amount', 'ASC']] }
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
      auctionEndsAt, isAddOnEligible, maxAddOnWeight } = req.body;

    const listing = await Listing.create({
      customerId: req.user.id, title, description, cargoType, weight, dimensions,
      pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng,
      auctionEndsAt, isAddOnEligible, maxAddOnWeight
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

// Mark delivered (partner)
router.post('/:id/deliver', auth, requireRole('partner'), async (req, res) => {
  try {
    const listing = await Listing.findByPk(req.params.id);
    if (!listing || listing.winnerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await listing.update({ status: 'delivered' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
