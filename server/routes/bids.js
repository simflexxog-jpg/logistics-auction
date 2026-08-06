const router = require('express').Router();
const { Op } = require('sequelize');
const { auth, requireRole } = require('../middleware/auth');
const { Bid, Listing, User, Payment } = require('../models');
const { validateReverseAuctionBid } = require('../utils/bidding');

// Place a bid (partner only)
router.post('/', auth, requireRole('partner'), async (req, res) => {
  try {
    const { listingId, amount, note } = req.body;
    const listing = await Listing.findOne({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'open') return res.status(400).json({ error: 'Auction is closed' });
    if (new Date(listing.auctionEndsAt) < new Date()) return res.status(400).json({ error: 'Auction has ended' });

    const amountNumber = Number(amount);
    const latestBid = await Bid.findOne({ where: { listingId }, order: [['createdAt', 'DESC']] });

    const validation = validateReverseAuctionBid({
      amount: amountNumber,
      latestBidAmount: latestBid?.amount ?? null
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (existing) {
      await existing.update({ amount: amountNumber, note });
      const updated = await existing.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });
      req.app.get('io')?.to(`listing:${listingId}`).emit('bid:updated', updated);
      return res.json(updated);
    }

    const bid = await Bid.create({ listingId, partnerId: req.user.id, amount: amountNumber, note });
    const full = await bid.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });

    req.app.get('io')?.to(`listing:${listingId}`).emit('bid:new', full);
    res.status(201).json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my bids (partner)
router.get('/my', auth, requireRole('partner'), async (req, res) => {
  try {
    const bids = await Bid.findAll({
      where: { partnerId: req.user.id },
      include: [{ model: Listing, include: [{ model: Payment, as: 'payment' }] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(bids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
