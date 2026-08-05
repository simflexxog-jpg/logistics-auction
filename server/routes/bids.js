const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Bid, Listing, User, Payment } = require('../models');
const redis = require('../config/redis');
const logger = require('../config/logger');
const validate = require('../middleware/validate');
const { z } = require('zod');

// Place a bid (partner / carrier only) with validation
const BidSchema = z.object({
  listingId: z.string().uuid().or(z.string().regex(/^[0-9]+$/)),
  amount: z.number().positive().max(10000000),
  note: z.string().optional(),
});

router.post('/', auth, requireRole('partner', 'CARRIER'), validate(BidSchema, 'body'), async (req, res) => {
  try {
    const { listingId, amount, note } = req.body;
    const listing = await Listing.findOne({ where: { id: listingId } });
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.status !== 'open') return res.status(400).json({ error: 'Auction is closed' });
    if (new Date(listing.auctionEndsAt) < new Date()) return res.status(400).json({ error: 'Auction has ended' });

    const existing = await Bid.findOne({ where: { listingId, partnerId: req.user.id } });
    if (existing) {
      await existing.update({ amount, note });
      const updated = await existing.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });
      logger.info({ auctionId: listingId, userId: req.user.id, amount, ip: req.ip, event: 'bid_updated' }, 'Bid updated');
      req.app.get('io')?.to(`listing:${listingId}`).emit('bid:updated', updated);
      try {
        // Update leaderboard sorted set (lower amount = better rank -> use negative score)
        const zkey = `auction:leaders:${listingId}`;
        await redis.zadd(zkey, -amount, `${req.user.id}`);
        if (listing && listing.auctionEndsAt) {
          const ttlMs = new Date(listing.auctionEndsAt).getTime() - Date.now();
          if (ttlMs > 0) await redis.pexpire(zkey, ttlMs);
        }
      } catch (e) {
        logger.warn({ err: e, listingId, userId: req.user.id }, 'Failed updating Redis leaderboard');
      }
      return res.json(updated);
    }

    const bid = await Bid.create({ listingId, partnerId: req.user.id, amount, note });
    const full = await bid.reload({ include: [{ model: User, as: 'partner', attributes: ['id', 'name', 'avgRating', 'truckType'] }] });
    logger.info({ auctionId: listingId, userId: req.user.id, amount, ip: req.ip, event: 'bid_created' }, 'Bid created');
    req.app.get('io')?.to(`listing:${listingId}`).emit('bid:new', full);
    try {
      const zkey = `auction:leaders:${listingId}`;
      await redis.zadd(zkey, -amount, `${req.user.id}`);
      if (listing && listing.auctionEndsAt) {
        const ttlMs = new Date(listing.auctionEndsAt).getTime() - Date.now();
        if (ttlMs > 0) await redis.pexpire(zkey, ttlMs);
      }
      // Cache active auction state
      const akey = `auction:state:${listingId}`;
      await redis.set(akey, JSON.stringify({ listingId, status: listing.status, endsAt: listing.auctionEndsAt }), 'PX', Math.max(0, new Date(listing.auctionEndsAt).getTime() - Date.now()));
    } catch (e) {
      logger.warn({ err: e, listingId, userId: req.user.id }, 'Failed updating Redis auction cache/leaderboard');
    }
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
