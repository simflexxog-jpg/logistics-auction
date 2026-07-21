const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const { Rating, Listing, User } = require('../models');

// Submit rating (customer only, after delivery)
router.post('/', auth, requireRole('customer'), async (req, res) => {
  try {
    const { listingId, stars, comment } = req.body;
    const listing = await Listing.findByPk(listingId);
    if (!listing || listing.customerId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    if (listing.status !== 'delivered') return res.status(400).json({ error: 'Not delivered yet' });

    const existing = await Rating.findOne({ where: { listingId } });
    if (existing) return res.status(400).json({ error: 'Already rated' });

    const rating = await Rating.create({ listingId, customerId: req.user.id, partnerId: listing.winnerId, stars, comment });

    // Update partner avg rating
    const partner = await User.findByPk(listing.winnerId);
    const newTotal = partner.totalRatings + 1;
    const newAvg = ((partner.avgRating * partner.totalRatings) + stars) / newTotal;
    await partner.update({ avgRating: Math.round(newAvg * 10) / 10, totalRatings: newTotal });

    res.status(201).json(rating);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
